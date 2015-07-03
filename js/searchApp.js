var searchApp = angular.module('searchApp', ['ngRoute', 'elasticsearch'])

.config(function($routeProvider) {
    $routeProvider

        .when('/', {
        templateUrl: 'pages/search.html',
        controller: 'searchController'
    })
})

.controller('searchController', ['$scope', 'searchService', function($scope, searchService) {
    $scope.results = {
        searchTerms: null,
        documents: []
    };

    var getResult = function() {
        searchService.search($scope.results.searchTerms).then(function(moviesIndexReturn) {
            $scope.results.documents = searchService.formatElasticSearchResult(moviesIndexReturn.hits.hits);
        });
    };

    $scope.searchTerms = null;

    $scope.search = function() {
        var searchTerms = $scope.searchTerms;

        if (!searchTerms) {
            return;
        }

        $scope.results.searchTerms = searchTerms;
        getResult();
    }

}])

.service('searchService', ['$q', 'esFactory', function($q, esFactory) {
    var elasticClient = esFactory({
        location: 'localhost:9200',
        log: 'trace'
    });

    /* elasticClient.ping({
         requestTimeout: 30000,

         // undocumented params are appended to the query string
         hello: "elasticsearch!"
     }, function(error) {
         if (error) {
             console.error('elasticsearch cluster is down!');
         } else {
             console.log('All is well');
         }
     });*/

    this.search = function(searchTerms) {
        var deferred = $q.defer();

        elasticClient.search({
            index: 'movies',
            query: {
                query_string: {
                    query: searchTerms
                }
            }
        }).then(function(moviesIndexReturn) {

            deferred.resolve(moviesIndexReturn);

        }, function(error) {

            deferred.reject(error);
        });


        return deferred.promise;
    }

    this.formatElasticSearchResult = function(documentsHits) {
        var fomartedResult = [];

        documentsHits.forEach(function(document) {
            fomartedResult.push(document._source);
        });

        return fomartedResult;
    }
}]);
