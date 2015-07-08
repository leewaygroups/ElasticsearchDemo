var searchApp = angular.module('searchApp', ['ngRoute', 'elasticsearch', 'ngSanitize'])

.config(function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'pages/search.html',
            controller: 'searchController'
        })
})

.controller('searchController', ['$scope', 'elasticFactory', '$sce', 'filterService', function($scope, elasticFactory, $sce, filterService) {
    $scope.searchTerms = null;
    $scope.noResults = false;
    $scope.isSearching = false;
    $scope.resultsPage = 0;

    $scope.results = {
        searchTerms: null,
        documentsCount: null,
        documents: []
    };

    //Autocomplete
    $scope.autocomplete = {
        suggestions: []
    };

    $scope.showAutocomplete = false;

    $scope.evaluateTerms = function(event) {
        var inputTerms = $scope.searchTerms ? $scope.searchTerms.toLowerCase() : null;

        if (event.keyCode === 13) {
            return;
        }

        if (inputTerms && inputTerms.length > 3) {
            getSuggestions(inputTerms);
        } else if (!inputTerms) {
            $scope.autocomplete = {};
            $scope.autocomplete = false;
        }
    };

    var getSuggestions = function(query) {
        elasticFactory.getSuggestions(query).then(function(es_return) {
            var suggestions = es_return.suggestions.phraseSuggestion;

            if (suggestions.length > 0) {
                $scope.autocomplete.suggestions = suggestions;
            } else {
                $scope.autocomplete.suggestions = [];
            }

            if (suggestions.length > 0) {
                $scope.showAutocomplete = true;
            } else {
                $scope.showAutocomplete = false;
            }
        });
    };

    $scope.filters = elasticFactory.filterService.filters;
    console.log("SCOPE FILTERS")
    console.log($scope.filters);

    //sort
    $scope.sortOptions = [{
        name: '_score',
        displayName: 'Relevancy',
        direction: 'desc'
    }, {
        name: 'year',
        displayName: 'Year',
        direction: 'asc'
    }];

    $scope.selectedSort = $scope.sortOptions[0];
    $scope.updateSort = function() {
        resetResults();
        getResults();
    };

    var resetResults = function() {
        $scope.noResults = false;
        $scope.resultsPage = 0;

        $scope.results.documents = [];
        $scope.results.documentsCount = null;
    };

    var getResults = function() {
        $scope.isSearching = true;

        elasticFactory.search($scope.results.searchTerms, $scope.resultsPage, $scope.selectedSort).then(function(moviesIndexReturn) {
            var totalHits = moviesIndexReturn.hits.total;

            if (totalHits) {
                $scope.results.documentsCount = totalHits;
                $scope.results.documents.push
                    .apply($scope.results.documents, elasticFactory.formatElasticSearchResult(moviesIndexReturn.hits.hits));

                filterService.formatFilters(moviesIndexReturn.aggregations);
                elasticFactory.filterService.formatFilters(moviesIndexReturn.aggregations);
            } else {
                $scope.noResults = true;
            }

            $scope.isSearching = false;


        }, function(error) {
            console.log("ERROR: " + error.message);
            $scope.isSearching = false;
        });
    };

    $scope.getNextPage = function() {
        $scope.resultsPage++;
        getResults();
    }

    $scope.$watchCollection(['results', 'noResults', 'isSearching'], function() {
        var documentCount = $scope.results.documentsCount;

        if ($scope.noResults || $scope.isSearchingm || !documentCount || documentCount <= $scope.results.documents.length) {
            $scope.canGetNextPage = false;
        } else {
            $scope.canGetNextPage = true;
        }
    });

    $scope.search = function() {
        resetResults();
        var searchTerms = $scope.searchTerms;

        if (!searchTerms) {
            return;
        }

        $scope.results.searchTerms = searchTerms;
        getResults();
    }

}])

.factory('elasticFactory', ['$q', 'esFactory', function($q, esFactory) {
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
}])

.service('filterService', [function() {
    this.filters = {
        availableFilters: {},
        selectedFilters: []
    };

    this.findSelectedFilter = function(field, value) {
        var selectedFilters = this.filters.selectedFilters;

        for (var i = 0; i < selectedFilters.length; i++) {
            var obj = selectedFilters[i];
            if (obj.field == field && obj.value == value) {
                return i;
            }
        }

        return -1;
    };

    this.formatFilters = function(aggregations) {
        var self = this;
        console.log(self);
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

                console.log("Filters");
                console.log(filters);

                formattedFilters[aggregation] = filters;
            }
        }
    };
}])

.directive('ngBindHtml', ['$sce', function($sce) {
    return function(scope, element, attr) {
        scope.$watch(attr.ngBindHtml, function ngBindHtmlWatchAction(value) {
            element.html($sce.getTrustedHtml(value) || '');
        });
    };
}]);
