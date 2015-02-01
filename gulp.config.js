module.exports = function() {

  var client = './src/client/';
  var server = './src/server/';
  var root = './';
  var report = './report/';
  var clientApp = client + 'app/';
  var temp = './.tmp/';
  var wiredep = require('wiredep');
  var bowerFiles = wiredep({devDependencies: true})['js'];

  var config = {
    alljs: ['./src/**/*.js', './*.js'],
    build: './build/',
    fonts: './bower_components/font-awesome/fonts/**/*.*',
    htmltemplates: clientApp + '**/*.html',
    html: clientApp+ '**/*.html',
    images: client + 'images/**/*.*',
    temp: temp,
    less: './src/client/styles/styles.less',
    getWiredepDefaultOptions: function() {
      var options = {
        bowerJson: this.bower.json,
        directory: this.bower.directory,
        ignorePath: this.bower.ignorePath
      };
      return options;
    },
    index: client + 'index.html',
    client: client,
    css: temp + '**/*.css',
    js: [
      clientApp + '**/*.module.js',
      clientApp + '**/*.js',
      '!'+ clientApp + '**/*.spec.js'
    ],
    bower: {
      json: require('./bower.json'),
      directory: './bower_components/',
      ignorePath: '../../'
    },
    packages: [
      './package.json',
      './bower.json'
    ],
    root: root,

    /*
     * template cache config
     * standAlone:  if true, it will create a new module and you need to reference it manually
     * module: the name of the module which contain the template
    * */
    templateCache: {
      file: 'templates.js',
      options: {
        module: 'app.core',
        standAlone: false,
        root: 'app/'
      }
    },

    serverIntegrationSpecs: [client+'tests/server-integration/**/*.spec.js'],

    defaultPort: 7203,
    nodeServer: './src/server/app.js',
    server: server
  };

  config.karma = getKarmaOptions();

  function getKarmaOptions() {
    var options = {
      files: [].concat(bowerFiles, 
                       config.specHelpers,
                       client + '**/*.module.js',
                       client + '**/*.js',
                       temp + config.templateCache.file,
                       config.serverIntegrationSpecs
                      ),
      exclude: [],
      coverage: {
        dir: report + 'coverage',
        reporters: [
          {type: 'html', subdir: 'report-html'},
          {type: 'lcov', subdir: 'report-lcov'},
          {type: 'text-summary'}
        ],
        preprocesors: {}
      }
    }; 

    //options.preprocesors[clientApp+'**/!(*.spec)+(.js)'] = ['coverage'];
    return options;
  }

  return config;
};
