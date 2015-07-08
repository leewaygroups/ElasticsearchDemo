searchApp.directive('ngBindHtml', ['$sce', function($sce) {
    return function(scope, element, attr) {
        scope.$watch(attr.ngBindHtml, function ngBindHtmlWatchAction(value) {
            element.html($sce.getTrustedHtml(value) || '');
        });
    };
}]);
