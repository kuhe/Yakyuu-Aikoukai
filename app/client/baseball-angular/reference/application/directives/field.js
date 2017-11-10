import ng from '@angular/core';

const FieldDirective = function() {
    return {
        //scope: {
        //    game: '=',
        //    text: '='
        //},
        templateUrl: 'public/html/views/directives/field.html?cache='+cacheKey,
        transclude : true,
        //link: function(scope) {
        //    scope.t = scope.text;
        //    scope.y = scope.game;
        //}
    };
};

(function(app) {
    app.FieldComponent = ng.core
        .Component({
            selector: 'field',
            templateUrl: FieldDirective().templateUrl,
            directives: []
        })
        .Class({
            constructor: function() {
            }
        });
})(window.app || (window.app = {}));

export default FieldDirective;