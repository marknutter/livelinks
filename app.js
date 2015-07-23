function LiveLinks(fbname) {

  var firebase = new Firebase("https://" + fbname + ".firebaseio.com/");
  this.fb = firebase;
  var linksRef = firebase.child('links');

  this.submitLink = function(url, title) {
    url = url.substring(0,4) !== "http" ? "http://" + url : url;
    linksRef.child(btoa(url)).set({
      title: title
    });
  };

  this.onLinksChanged = function() {}

  linksRef.on('value', function(snapshot) {
    var links = snapshot.val();
    var preparedLinks = [];
    for (var url in links) {
      if (links.hasOwnProperty(url)) {
        preparedLinks.push({
          title: links[url].title,
          url: atob(url)
        })
      }
    }
    this.onLinksChanged(preparedLinks);
  }.bind(this));

};





$(document).ready(function() {

  var ll = new LiveLinks('livelinks');

  $(".link-form form").submit(function(event) {
    event.preventDefault();
    ll.submitLink($(this).find('input.link-url').val(), $(this).find('input.link-title').val());
    $(this).find("input[type=text]").val("").blur();
    return false;
  })

  ll.onLinksChanged = function(links) {
    $(".links-list").empty();
    links.map(function(link) {
      var linkElement = "<li><a href='" + link.url + "'>" + link.title + "</a></li>";
      $(".links-list").append(linkElement);
    });
  };

});





