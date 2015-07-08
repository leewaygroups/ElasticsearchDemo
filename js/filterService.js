searchApp.service('filterService', [function() {
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
}]);
