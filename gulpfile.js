var gulp = require('gulp');
var args = require('yargs').argv;
var del = require('del');
var path = require('path');
var _ = require('lodash');
var browserSync = require('browser-sync');
var config = require('./gulp.config')();
var port = process.env.PORT || config.defaultPort;

var $ = require('gulp-load-plugins')({lazy: true});

//var jshint = require('gulp-jshint');
//var jscs = require('gulp-jscs');
//var util = require('gulp-util');
//var print = require('gulp-print');
//var gulpif = require('gulp-if');

gulp.task('help', $.taskListing);
gulp.task('default', ['help']);

gulp.task('vet', function() {
    log('Analyzing source with jshint and jshint');
    return gulp.src(config.alljs)
    .pipe($.if(args.verbose, $.print()))
    .pipe($.jscs())
    .pipe($.jshint())
    .pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
    .pipe($.jshint.reporter('fail'));
});

gulp.task('styles', ['clean-styles'], function() {
  log('Compileing Less --> css');

  return gulp.src(config.less)
             .pipe($.plumber())
             .pipe($.less())
             //.on('error', errorLogger)
             .pipe($.autoprefixer())
             .pipe(gulp.dest(config.temp));
});

gulp.task('fonts', function() {
  log('copying fonts');
  return gulp.src(config.fonts)
             .pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('images', function() {
  return gulp.src(config.images)
             .pipe($.imagemin({optimizationLevel: 4}))
             .pipe(gulp.dest(config.build + 'images'));
});

gulp.task('templatecache', ['clean-code'], function() {
   return gulp.src(config.htmltemplates) 
            // gulp-angular-templatecache  ==> $.angularTemplatecache
              .pipe($.minifyHtml({empty: true}))
              .pipe($.angularTemplatecache(config.templateCache.file, config.templateCache.options))
              .pipe(gulp.dest(config.temp));
});

gulp.task('clean', function(done) {
  log('clean all files');
});

gulp.task('clean-styles', function(done) {
  var files = config.temp + '**/*.css';
  clean(files, done);
});

gulp.task('clean-code', function(done) {
  var files = [].concat(config.temp+ '**/*.js', config.build + '**/*.html', config.build+'js/**/*.js');
  clean(files, done);
});

gulp.task('clean-fonts', function(done) {
  clean(config.build + 'fonts/**/*.*', done);
});

gulp.task('clean-images', function(done) {
  clean(config.build + 'images/**/*.*', done);
});

gulp.task('wiredep', function() {
  var options = config.getWiredepDefaultOptions();
  var wiredep = require('wiredep').stream;
  log(options.directory);

  return gulp.src(config.index)
             .pipe(wiredep(options))
             .pipe($.inject(gulp.src(config.js)))
             .pipe(gulp.dest(config.client));
});

gulp.task('less-watcher', function() {
  gulp.watch([config.less], ['styles']);
});

gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function() {
  log(config.css)
  return gulp.src(config.index)
             .pipe($.inject(gulp.src(config.css)))
             .pipe($.print())
             .pipe(gulp.dest(config.client));
});

gulp.task('build', ['optimize', 'images', 'fonts'], function() {
  var msg = {
    title: 'gulp build',
    subtitle: 'Deployed to the build folder',
    message: 'Running gulp serve-build'
  };

  del(config.temp);
  log(msg);
  notify(msg);
});

gulp.task('optimize', ['inject'], function() {
  log('optimize file for production');

  var assets = $.useref.assets({searchPath: './'});
  var templateCache = config.temp + config.templateCache.file;
  var cssFilter = $.filter('**/*.css');
  var jsFilter = $.filter('**/*.js');

  return gulp.src(config.index)
            .pipe($.plumber())  //for error handling
            .pipe($.inject(gulp.src(templateCache, {read: false}), {
              starttag: '<!-- inject:templates:js -->'  // inject to the place that start with the tag
            }))
            .pipe(assets)
            // filter the css file
            .pipe(cssFilter)
            // optimize css file
            .pipe($.csso())
            // restore the filter
            .pipe(cssFilter.restore())
            //filter the js files
            .pipe(jsFilter)
            // uglify the js file
            .pipe($.uglify())
            // restore the filter
            .pipe(jsFilter.restore())
            .pipe($.rev())   // app.js --> app-a912adf.js
            .pipe(assets.restore())
            .pipe($.useref())
            .pipe($.revReplace())
            .pipe(gulp.dest(config.build))
            // generate manifest file
            //.pipe($.rev.manifest())
            // save the manifest file config.build folder
            //.pipe(gulp.dest(config.build));
});

/*
*  bumping version
*  --type=pre will bump the prerelease version
*  --type=patch or no flag will bump the patch version
*  --type=minor will bump the minjor version
*  --type=major will bump the major version
*  --version=1.2.3 will bump to a specific version
* */
gulp.task('bump', function() {
  var msg = 'bumping versions'
  var type = args.type; 
  var version = args.version;
  var options = {};
  if(version) {
    options.version = version;

  } else {
    options.type = type;
  }

  return gulp.src(config.packages)
  .pipe($.bump(options))
  .pipe(gulp.dest(config.root));

})

gulp.task('serve-dev', ['inject'], function() {
  serve(true);
});

gulp.task('serve-build', ['inject', 'fonts', 'images'], function() {
  serve(false);
});

gulp.task('test', ['vet', 'templatecache'], function() {
  startTests(true /*single run*/, done);
});

//gulp.task('serve-build', )


///////////////////////////////////////

function notify(options) {
  var notifier = require('node-notifier');
  var notifyOptions = {
    sound: 'Bottle',
    contentImage: path.join(__dirname, 'gulp.png'),
    icon: path.join(__dirname, 'gulp.png')
  };
  _.assign(notifyOptions, options);
  console.log('notify');
  notifier.notify(notifyOptions);
}

function startTests(singleRun, done) {
  var child;
  var fork = require('child_process').fork;
  var karma = require('karma').server;
  var excludeFiles = [];
  var serverSpecs = config.serverIntegrationSpecs; //TODO:
  excludeFiles = [];

  //if run with flag --startServers, then start nodeserver
  if(args.startServers) {
    log('starting server') ;
    child = fork(config.nodeServer);
  } else { //otherwise, exclude the serverspecs then only run unit tests
    if(serverSpecs && serverSpecs.length)  {
      excludeFiles  = serverSpecs;
    }
  }

  karma.start({
    config: __dirname + '/karma.conf.js',
    exclude: excludeFiles,
    single: !!singleRun
  }, karmaCompleted);

  function karmaCompleted(karmaResult) {
    if(child) {
      log('kill the child process')
      child.kill();
    }
    if(karmaResult === 1) {
      done('karma: tests failed with code ' + karmaResult);
    } else {
      done();
    }
  }

}

function serve(isDev) {
  var port = 3000;
  var nodeOptions = {
    script: config.nodeServer,
    delayTime: 1,
    env: {
      'PORT': port,
      'NODE_ENV': isDev ? 'dev' : 'build',
    },
    watch: [config.server]
  };
  $.nodemon(nodeOptions)
    .on('restart',['vet'] ,function(ev) { //can add dependence before it restart
      log('**** nodemon restarted');
      log('files changed on restart: \n' + ev);
    })
    .on('start', function() {
      log('nodemon started');
      startBrowserSync(isDev);
    })
    .on('crash', function() {
      log('nodemon crash');
    })
    .on('exit', function() {
      log('nodemon exit');
    });
}

function changeEvent(event) {
  log(event.type);
  log(event.source);
}

function startBrowserSync(isDev) {
  if(browserSync.active) {
    return;
  }
  log('starting browser-sync on port ' + port);


  if(isDev) {
  
    gulp.watch([config.less], ['styles'])
    .on('change', function(event){
      changeEvent(event);
    });
  } else {
    gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
    .on('change', function(event){
      changeEvent(event);
    });
  }

  var options = {
    proxy: 'localhost:3000',
    port: 4000,
    files: isDev ? [
      config.client + '**/*.*',
      '!' + config.less,
      config.temp + '**/*.css'
    ] : [],
    ghostMode: {
      clicks: true,
      location: false,
      forms: true,
      scroll: true
    },
    injectChanges: true,
    logFileChanges: true,
    logLevel: 'debug',
    logPrefix: 'gulp-patterns',
    notify: true,
    reloadDelay: 1000
  };

  browserSync(options);
}

function clean(path, done) {
  log('cleaning files');
  del(path, done);
}

function log(msg) {
  $.util.log($.util.colors.blue(msg));
}

function errorLogger(error) {
  log(error);
}
