var Main = Packages.org.apache.camel.main.Main;
var RouteBuilder = Packages.org.apache.camel.builder.RouteBuilder;
var BasicDataSource = Packages.org.apache.commons.dbcp2.BasicDataSource;
var IOException = Packages.java.io.IOException;
var Properties = Packages.java.util.Properties;
var LoggerFactory = Packages.org.slf4j.LoggerFactory;
var Files = Packages.java.nio.file.Files;
var Paths = Packages.java.nio.file.Paths;
var Integer = Packages.java.lang.Integer;

var LOG = LoggerFactory.getLogger('main');

var twitterRouteBuilder = Java.extend(RouteBuilder);
var route = new twitterRouteBuilder() {
  configure: function() {
    var dsl = Java.super(route);

    // Create route to store tweets in database
    dsl.from('seda:tweet2db?multipleConsumers=true&concurrentConsumers='+dsl.getContext().getRegistry().lookupByName('db.pool'))
       .setHeader('id', dsl.simple('${body.getId()}'))
       .setHeader('status', dsl.simple('${body.getText()}'))
       .setHeader('created', dsl.simple('${body.getCreatedAt().getTime()}'))
       .setHeader('screenname', dsl.simple('${body.getUser().getScreenName()}'))
       .setBody(dsl.constant('INSERT INTO tweets (id, status, created, screenname) VALUES (:?id, :?status, :?created, :?screenname)'))
       .to('jdbc:lykely?useHeadersAsParameters=true');

    // Create route to log every 10th tweet
    dsl.from('seda:tweet2log?multipleConsumers=true&concurrentConsumers=5')
       .sample(10).log(dsl.simple('${body.getText()}').getText());

    // Build the twitter streaming URL
    var baseUrl = 'twitter://streaming/filter?type=event&lang=en&consumerKey='+dsl.getContext().getRegistry().lookupByName('api.key')+'&';
    baseUrl += 'consumerSecret='+dsl.getContext().getRegistry().lookupByName('api.secret')+'&';
    baseUrl += 'accessToken='+dsl.getContext().getRegistry().lookupByName('access.token')+'&';
    baseUrl += 'accessTokenSecret='+dsl.getContext().getRegistry().lookupByName('access.secret')+'&';
    baseUrl += 'keywords=#grammys';

    // Create route to pull tweets from event based stream
    dsl.from(baseUrl)
       .filter(dsl.simple('${body.isRetweet()} == false')) // Filter out retweets
       .multicast().to('seda:tweet2db', 'seda:tweet2log'); // Multicast tweets to DB and logs
  }
};

var props = new Properties();
try {
  // Load the twitter.properties config
  var props = new Properties();
  var path = Paths.get('twitter.properties');
  var fis = Files.newInputStream(path);
  props.load(fis);

  // Build a connection pooling datasource
  var ds = new BasicDataSource();
  ds.setDriverClassName("org.postgresql.Driver");
  ds.setUrl(props.getProperty('db.url'));
  ds.setUsername(props.getProperty('db.user'));
  ds.setPassword(props.getProperty('db.pass'));
  try {
    ds.setMaxTotal(Integer.parseInt(props.getProperty('db.pool')));
  } catch (nfe) {
    LOG.error('Unable to parse integer: '+nfe.message+' - '+props.getProperty('db.pool'));
    ds.setMaxTotal(20);
  }
  
  // Initialize the Camel Context and bind the configuration
  var main = new Main();
  main.bind('lykely', ds);
  props.entrySet().forEach(function (e) {
    main.bind(e.getKey(), e.getValue());
  });

  // Attach the routes to the CamelContext
  main.addRouteBuilder(route);

  // Start the Camel Context
  main.run();
} catch (err) {
  LOG.error(err.message);
}

