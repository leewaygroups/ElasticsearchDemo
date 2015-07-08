searchApp.controller('searchController', ['$scope', 'elasticFactory', '$sce', 'filterService', function($scope, elasticFactory, $sce, filterService) {
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

}]);
