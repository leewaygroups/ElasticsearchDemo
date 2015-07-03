var searchApp = angular.module('searchApp', ['ngRoute', 'elasticsearch'])

.config(function($routeProvider) {
    $routeProvider
        .when('/', {
            templateUrl: 'pages/search.html',
            controller: 'searchController'
        })
})

.controller('searchController', ['$scope', 'elasticFactory', function($scope, elasticFactory) {
    $scope.searchTerms = null;
    $scope.noResults = false;
    $scope.isSearching = false;

    $scope.results = {
        searchTerms: null,
        documentsCount: null,
        documents: []
    };

    var resetResults = function(){
        $scope.noResults = false;
        $scope.results.documents = [];
        $scope.results.documentsCount = null;
    }

    var getResult = function() {
        $scope.isSearching = true;

        elasticFactory.search($scope.results.searchTerms).then(function(moviesIndexReturn) {
            var totalHits = moviesIndexReturn.hits.total;

            if(totalHits){
                $scope.results.documentsCount = totalHits;
                $scope.results.documents = elasticFactory.formatElasticSearchResult(moviesIndexReturn.hits.hits);
            }else{
                $scope.noResults = true;
            }

            $scope.isSearching = false;


        }, function(error){
            console.log("ERROR: " + error.message);
            $scope.isSearching = false;
        });
    };

    $scope.search = function() {
        resetResults();
        var searchTerms = $scope.searchTerms;

        if (!searchTerms) {
            return;
        }

        $scope.results.searchTerms = searchTerms;
        getResult();
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
    }

    service.search = function(searchTerms) {
        var deferred = $q.defer();

        elasticClient.search({
            index: 'movies',
            body: {
                "query": {
                    "match": {
                        "title": searchTerms
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

    service.formatElasticSearchResult = function(documentsHits) {
        var fomartedResult = [];

        documentsHits.forEach(function(document) {
            fomartedResult.push(document._source);
        });

        return fomartedResult;
    };

    return service;
}]);
