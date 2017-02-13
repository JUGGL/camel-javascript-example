var Main = Packages.org.apache.camel.main.Main;
var RouteBuilder = Packages.org.apache.camel.builder.RouteBuilder;
var BasicDataSource = Packages.org.apache.commons.dbcp2.BasicDataSource;
var IOException = Packages.java.io.IOException;
var Properties = Packages.java.util.Properties;
var LoggerFactory = Packages.org.slf4j.LoggerFactory;
var Files = Packages.java.nio.file.Files;
var Paths = Packages.java.nio.file.Paths;
var Integer = Packages.java.lang.Integer;

var props = new Properties();

var path = Paths.get("twitter.properties");

var fis = Files.newInputStream(path);

props.load(fis);

props.entrySet().forEach(function(e) {
  console.log(e.getKey()+": "+e.getValue());
});
