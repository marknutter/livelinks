function LiveLinks(fbname) {

  var firebase = new Firebase("https://" + fbname + ".firebaseio.com/");
  this.firebase = firebase;
  var linksRef = firebase.child('links');
  var usersRef = firebase.child('users');
  var instance = this;

  this.submitLink = function(url, title) {
    url = url.substring(0,4) !== "http" ? "http://" + url : url;
    linksRef.child(btoa(url)).set({
      title: title
    });
  };

  this.login = function(email, password) {
  	firebase.authWithPassword({
  		email: email,
  		password: password
  	}, function(error) {
  		if (error) { instance.onError(error) }
  	});
  };

  this.signup = function(alias, email, password) {
  	firebase.createUser({
  		email: email, 
  		password: password
  	}, function(error, authResponse) {
  		if (error) {
  			instance.onError(error);
  		} else {
	  		instance.auth = authResponse;
	  		usersRef.child(instance.auth.uid).set({alias: alias}, function(error) {
	  			if (error) {
	  				instance.onError(error);
	  			} else {
	  				instance.login(email, password);
	  			}
	  		});
  		}
  	});
  };

  this.logout = function() {
  	firebase.unauth();
  };

  // overrideable event functions
  this.onLogin = function(user) {};
  this.onLogout = function() {};
  this.onLinksChanged = function(links) {};
  this.onError = function(error) {};


  // setup long-running firebase listeners 
  this.start = function() {

	  firebase.onAuth(function(authResponse) {
	  	if (authResponse) {
	  		usersRef.child(authResponse.uid).once('value', function(snapshot) {
	  			instance.user = snapshot.val();
	  			instance.onLogin(instance.user);
	  		});
	  	} else {
	  		instance.onLogout();
	  	}
	  });

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
	    instance.onLinksChanged(preparedLinks);
	  });

  };

};


$(document).ready(function() {

	var ll = new LiveLinks('livelinks1234');

	ll.onError = function(error) {
		alert(error.message);
	}

	$(".show-submit-link").click(function() {
		$(".link-form").toggle();		
	});

	$(".link-form form").submit(function(event) {
    ll.submitLink($(this).find('input.link-url').val(), $(this).find('input.link-title').val());
    $(".link-form").hide();
    return false;
  });

  ll.onLinksChanged = function(links) {
    $(".links-list").empty();
    links.map(function(link) {
      var linkElement = "<li class='list-group-item'><a href='" + link.url + "'>" + link.title + "</a></li>";
      $(".links-list").append(linkElement);
    });
  };

  ll.onLogin = function() {
  	$(".auth-links .login, .auth-links .signup, .auth-forms").hide();
  	$(".auth-links .logout").show();
  };

  ll.onLogout = function() {
  	$(".auth-links .login, .auth-links .signup").show();
  	$(".auth-links .logout").hide();
  };

  $(".auth-links .login a").click(function() {
  	$(".auth-forms, .auth-forms .login").show();
  	$(".auth-forms .signup").hide();
  	return false;
  });

  $(".auth-links .signup a").click(function() {
  	$(".auth-forms .login").hide();
  	$(".auth-forms, .auth-forms .signup").show();
  	return false;
  });

  $(".auth-links .logout a").click(function() {
  	ll.logout();
  	return false;
  });

  $(".auth-forms .login form").submit(function(event) {
    ll.login($(this).find('input.login-email').val(), $(this).find('input.login-password').val());
    return false;
  });

  $(".auth-forms .signup form").submit(function(event) {
  	var alias = $(this).find('input.signup-alias').val(),
    	  email = $(this).find('input.signup-email').val(), 
    	  password = $(this).find('input.signup-password').val(),
    	  passwordConfirm = $(this).find('input.signup-password-confirm').val();
    if (password === passwordConfirm) {
	    ll.signup(alias, email, password);
    }
    return false;
  });


  ll.start();

});






