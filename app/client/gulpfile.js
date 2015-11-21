var gulp = require('gulp'),
    less = require('gulp-less'),
    concat = require('gulp-concat'),
    uglify = require('gulp-uglify'),
    sourcemaps = require('gulp-sourcemaps'),
    babel = require('babel');
var browserify = require('browserify'),
    babelify = require('babelify');
var fs = require('fs');
var util = require('gulp-util');

var name = 'baseball';

var INTERNAL_STYLE_FILES = [
    './styles/**/*.less',
    './styles/application.less'
];
var EXTERNAL_STYLE_FILES = [
    './bower_components/bootstrap/dist/css/bootstrap.min.css'
];
var MODULAR_SCRIPT_FILES = [
    './node_modules/'+name+'/**/*.js',
    '!./node_modules/'+name+'/node_modules/**/*.js',
    '!./node_modules/'+name+'/bundle.js'
];
var INTERNAL_SCRIPT_FILES = [
    './scripts/application/controllers/*.js',
    './scripts/application/services/*.js',
    './scripts/application/directives/*.js',
    './scripts/application/application.js'
];
var BUNDLE_SCRIPT_FILES = [
    './node_modules/'+name+'/bundle.js',
    './scripts/application/controllers/*.js',
    './scripts/application/services/*.js',
    './scripts/application/directives/*.js',
    './scripts/application/application.js'
];
var EXTERNAL_SCRIPT_FILES = [
    './bower_components/es5-shim/es5-shim.js',
    './bower_components/es5-shim/es5-sham.js',
    './bower_components/html5shiv/dist/html5shiv.js',
    './bower_components/respond/src/respond.js',
    './bower_components/jquery/dist/jquery.js',
    './bower_components/angular/angular.js',
    './bower_components/angular-sanitize/angular-sanitize.js',
    './bower_components/angular-route/angular-route.js',
    './bower_components/gsap/src/uncompressed/TweenMax.js',
    './bower_components/three.js/three.min.js'
];

var STYLE_DEPLOY_DIR = '../../public/css';
var SCRIPT_DEPLOY_DIR = '../../public/js';

gulp.task('internalStyles', function () {
    gulp.src(INTERNAL_STYLE_FILES[1])
        .pipe(less({
            'indent spaces': 4
        }))
        .pipe(gulp.dest(STYLE_DEPLOY_DIR));
});
gulp.task('externalStyles', function () {
    gulp.src(EXTERNAL_STYLE_FILES)
        .pipe(gulp.dest(STYLE_DEPLOY_DIR));
});
gulp.task('modularScripts', function () {
    browserify({ entries: './node_modules/'+name+'/'+name+'.js' })
        .transform(babelify)
        .bundle()
        .pipe(fs.createWriteStream('./node_modules/'+name+'/bundle.js')).on('close', function() {
            gulp.start('internalScripts');
        })
        .on('error', util.log);
    return 1;
});
gulp.task('internalScripts', function () {
    gulp.src(BUNDLE_SCRIPT_FILES)
        .pipe(sourcemaps.init())
        .pipe(concat('application.min.js'))
        .pipe(uglify({ mangle: false }))
        .on('error', util.log)
        .pipe(sourcemaps.write('./sourcemaps'))
        .pipe(gulp.dest(SCRIPT_DEPLOY_DIR));
    gulp.src(BUNDLE_SCRIPT_FILES)
        .pipe(sourcemaps.init())
        .pipe(concat('application.js'))
        .pipe(sourcemaps.write('./sourcemaps'))
        .pipe(gulp.dest(SCRIPT_DEPLOY_DIR));
    return 1;
});
gulp.task('externalScripts', function () {
    gulp.src(EXTERNAL_SCRIPT_FILES)
        .pipe(sourcemaps.init())
        .pipe(concat('vendor.min.js'))
        .pipe(uglify({ mangle: false }))
        .pipe(sourcemaps.write('./sourcemaps'))
        .pipe(gulp.dest(SCRIPT_DEPLOY_DIR))
});

gulp.task('build', [
  'internalStyles', 'externalStyles', 'modularScripts', 'externalScripts'
]);

gulp.task('watch', ['build'], function () {
    gulp.run('build');
    gulp.watch(MODULAR_SCRIPT_FILES, ['modularScripts']);
    gulp.watch(INTERNAL_SCRIPT_FILES, ['internalScripts']);
    gulp.watch(INTERNAL_STYLE_FILES, ['internalStyles']);
});

gulp.task('default', ['watch']);
