searchApp.factory('elasticFactory', ['$q', 'esFactory', function($q, esFactory) {
    var service = {};
    var elasticClient = esFactory({
        location: 'localhost:9200',
        log: 'trace'
    });

    service.serverUtils = {
        pingElasticServer: function() {
            elasticClient.ping({
                requestTimeout: 30000,

                hello: "elasticsearch!"
            }, function(error) {
                if (error) {
                    console.error('Wahala!!!, elasticsearch cluster is down!');
                } else {
                    console.log('All is well, even inside the well!!!');
                }
            });
        }
    };

    service.search = function(searchTerms, resultsPage, selectedSort) {
        var deferred = $q.defer();

        var sortObject = {};
        sortObject[selectedSort.name] = selectedSort.direction;

        elasticClient.search({
            index: 'movies',
            body: {
                "query": {
                    "match": {
                        _all: searchTerms
                    }
                },
                sort: [sortObject],
                from: resultsPage * 10,
                aggs: {
                    genre: {
                        terms: {
                            field: "genres"
                        }
                    }
                },
                highlight: {
                    fields: {
                        "title": {
                            number_of_fragmenets: 0
                        },
                        "director": {
                            number_of_fragmenets: 0
                        }
                    }
                }
            }
        }).then(function(moviesIndexReturn) {

            deferred.resolve(moviesIndexReturn);

        }, function(error) {

            deferred.reject(error);
        });

        return deferred.promise;
    };

    service.getSuggestions = function(query) {
        var deferred = $q.defer();

        elasticClient.search({
            index: 'movies',
            body: {
                "suggest": {
                    "text": query,
                    "phraseSuggestion": {
                        "phrase": {
                            "field": "title",
                            "direct_generator": [{
                                "field": "title",
                                "suggest_mode": "popular",
                                "min_word_length": 3,
                                "prefix_length": 2
                            }]
                        }
                    }
                },
                "size": 0
            }
        }).then(function(moviesIndexReturn) {

            deferred.resolve(moviesIndexReturn);

        }, function(error) {

            deferred.reject(error);
        });

        return deferred.promise;
    };

    service.formatElasticSearchResult = function(documentsHits) {
        var fomartedResult = [];

        documentsHits.forEach(function(document) {
            var documunetSource = document._source;

            angular.forEach(documunetSource, function(value, field) {
                var highlights = document.highlight || {};
                var highlight = highlights[field] || false;

                if (highlight) {
                    documunetSource[field] = highlight[0];
                }
            });


            fomartedResult.push(document._source);
        });

        return fomartedResult;
    };

    service.filterService = {
        filters: {
            availableFilters: {},
            selectedFilters: []
        },

        findSelectedFilter: function(field, value) {
            var selectedFilters = this.filters.selectedFilters;

            for (var i = 0; i < selectedFilters.length; i++) {
                var obj = selectedFilters[i];
                if (obj.field == field && obj.value == value) {
                    return i;
                }
            }

            return -1
        },

        formatFilters: function(aggregations) {
            var self = this;
            var formattedFilters = {};

            for (var aggregation in aggregations) {
                if (aggregations.hasOwnProperty(aggregation)) {
                    var filters = aggregations[aggregation].buckets.map(function(obj) {
                        var isSelected = function() {
                            return self.findSelectedFilter(aggregation, obj.key) == -1 ? false : true;
                        };

                        return {
                            value: obj.key,
                            count: obj.doc_count,
                            isSelected: isSelected()
                        }
                    });

                    formattedFilters[aggregation] = filters;
                    self.filters.availableFilters = filters;

                    console.log("Inside Factory");
                    console.log(filters);
                }
            }
        }
    };

    return service;
}]);
