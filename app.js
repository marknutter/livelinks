function LiveLinks(fbname) {

  var firebase = new Firebase("https://" + fbname + ".firebaseio.com/");
  this.firebase = firebase;
  var linksRef = firebase.child('links');
  var usersRef = firebase.child('users');
  var votesRef = firebase.child('votes');
  var aliasesRef = firebase.child('aliases');
  var instance = this;

  this.submitLink = function(url, title) {
    url = url.substring(0,4) !== "http" ? "http://" + url : url;
    var linkRef = linksRef.child(btoa(url));
    linkRef.update({
      title: title
    }, function(error) {
      if (error) { 
        instance.onError(error)
      } else {
        linkRef.child('users')
               .child(instance.auth.uid)
               .set(true)
        usersRef.child(instance.auth.uid)
                .child('links')
                .child(btoa(url))
                .set(true);
        instance.vote(btoa(url), 1);
        linkRef.child('author')
               .set(instance.auth.uid);        
        linkRef.child('createdAt')
               .set(Firebase.ServerValue.TIMESTAMP);
      } 
    });
  };

  this.vote = function(linkId, voteVal) {
    linksRef.child(linkId)
            .child('votes')
            .child(instance.auth.uid)
            .set(voteVal);
  }

  this.login = function(email, password) {
  	firebase.authWithPassword({
  		email: email,
  		password: password
  	}, function(error) {
  		if (error) { instance.onError(error) }
  	});
  };

  this.signup = function(alias, email, password) {
    aliasesRef.child(alias).once('value', function(snapshot) {
      if (snapshot.val()) {
        instance.onError({message: "That alias is taken"});
      } else {
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
                aliasesRef.child(alias).set(instance.auth.uid);
    	  				instance.login(email, password);
    	  			}
    	  		});
      		}
      	});
      }
    })
  };

  this.logout = function() {
  	firebase.unauth();
  };

  function getSubmitters(linkId, userIds) {
    if (userIds) {
      $.each(userIds, function(userId) {
        var linkUserRef = linksRef.child(linkId).child('users').child(userId);
        linkUserRef.once('value', function(snapshot) {
          usersRef.child(snapshot.key())
                  .child('alias')
                  .once('value', function(snapshot) {
                    instance.onLinkUserAdded(linkId, snapshot.val());
                  });
        });
      });
    }
  }

  // overrideable event functions
  this.onLogin = function(user) {};
  this.onLogout = function() {};
  this.onLinksChanged = function(links) {};
  this.onLinkUserAdded = function(linkId, alias) {};
  this.onError = function(error) {};


  // setup long-running firebase listeners 
  this.start = function() {

	  firebase.onAuth(function(authResponse) {
	  	if (authResponse) {
        instance.auth = authResponse;
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
          var voteTotal = 0;
          if (links[url].votes) {
            $.each(links[url].votes, function(userId, val) {
              voteTotal += val;
            });
          }
	        preparedLinks.push({
	          title: links[url].title,
	          url: atob(url),
            id: url,
            voteTotal: voteTotal
	        })
        getSubmitters(url, links[url].users);  
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
      var linkElement = "<li data-id='" + link.id + "' class='list-group-item'>"  + 
                          "<span class='vote-total'>" + link.voteTotal + "</span>" +
                          "<span class='glyphicon glyphicon-triangle-top up vote' data-val='1'></span>"   +
                          "<span class='glyphicon glyphicon-triangle-bottom down vote' data-val='-1'></span>"   +
                          "<a href='" + link.url + "'>" + link.title + "</a><br>" + 
                          "<span class='submitters'>submitted by:</span>"         + 
                        "</li>";
      $(".links-list").append(linkElement);
    });

    $(".vote").click(function(event) {
      ll.vote($(this).parent().data().id, $(this).data().val);
    });
  };

  ll.onLinkUserAdded = function(linkId, alias) {
    var submitters = $("[data-id='" + linkId + "'] span.submitters");
    if (submitters.text().indexOf(alias) == -1) {
      submitters.append(" " + alias);
    }
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






