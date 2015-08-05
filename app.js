function LiveLinks(fbname) {

  var firebase = new Firebase("https://" + fbname + ".firebaseio.com/");
  this.firebase = firebase;
  var linksRef = firebase.child('links');
  var usersRef = firebase.child('users');
  var votesRef = firebase.child('votes');
  var aliasesRef = firebase.child('aliases');
  var daysRef = firebase.child('days');
  var dateString = (new Date()).toDateString();
  var todayRef = daysRef.child(dateString);
  var numberOfLinksToShow = 5;
  var instance = this;

  this.submitLink = function(url, title) {
    url = url.substring(0,4) !== "http" ? "http://" + url : url;
    var linkId = btoa(url);
    var linkRef = linksRef.child(linkId);
    linkRef.update({
      title: title
    }, function(error) {
      if (error) { 
        instance.onError({message: "Link already added"});
      } else {
        linkRef.child('author')
               .set(instance.auth.uid);        
        linkRef.child('createdAt')
               .set(Firebase.ServerValue.TIMESTAMP, function(error) {
                 if (!error) {
                   daysRef.child(dateString).child(linkId).set(1);
                   instance.vote(linkId, 1);
                 }
               });
      } 
      linkRef.child('users')
               .child(instance.auth.uid)
               .set(true)
      usersRef.child(instance.auth.uid)
              .child('links')
              .child(linkId)
              .set(true);
    });
  };

  this.vote = function(linkId, voteVal) {
    linksRef.child(linkId)
            .child('votes')
            .child(instance.auth.uid)
            .set(voteVal, function() {
              linksRef.child(linkId).child('votes').once('value', function(snapshot) {
                var votes = snapshot.val();
                var voteTotal = 0;
                if (votes) {
                  $.each(votes, function(userId, val) {
                    voteTotal += val;
                  });
                }
                daysRef.child(dateString)
                       .child(linkId)
                       .set(voteTotal);
              })
            });
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

  this.showMoreLinks = function() {
    numberOfLinksToShow += 5;
    todayRef.orderByValue().limitToLast(numberOfLinksToShow).off('value', prepareLinks);
    todayRef.orderByValue().limitToLast(numberOfLinksToShow).on('value', prepareLinks);
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

  function getLinkMetadata(preparedLink) {
    linksRef.child(preparedLink.id).once('value', function(snapshot) {
      var link = snapshot.val();
      preparedLink.title = snapshot.val().title;
      instance.onLinkMetadataAdded(preparedLink);
      getSubmitters(preparedLink.id, link.users);
    });
  }

  function prepareLinks(snapshot) {
    var links = snapshot.val();
    var preparedLinks = [];
    if (links) {
      $.each(links, function(url, voteTotal) {
        var preparedLink = {
          url: atob(url),
          id: url,
          voteTotal: voteTotal
        };
        getLinkMetadata(preparedLink);
        preparedLinks.push(preparedLink);
      });
      var sortedLinks = preparedLinks.sort(function (a, b) {
          return b.voteTotal -  a.voteTotal;
      });
      instance.onLinksChanged(sortedLinks);
    }
  }

  // overrideable event functions
  this.onLogin = function(user) {};
  this.onLogout = function() {};
  this.onLinksChanged = function(links) {};
  this.onLinkMetadataAdded = function(links) {};
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

	  todayRef.orderByValue().limitToLast(numberOfLinksToShow).on('value', prepareLinks);

  };

};


$(document).ready(function() {

	var ll = new LiveLinks('livelinks1234');
  var numberOfLinksShowing = 0;

	ll.onError = function(error) {
		alert(error.message);
	}

	$(".show-submit-link").click(function() {
		$(".link-form").toggle();		
	});

	$(".link-form form").submit(function(event) {
    ll.submitLink($(this).find('input.link-url').val(), $(this).find('input.link-title').val());
    $(this).find('input.link-url').val('');
    $(this).find('input.link-title').val('');
    $(this).parent().hide();
    return false;
  });

  ll.onLinksChanged = function(links) {
    if (links.length - numberOfLinksShowing < 5) {
      $(".show-more").hide();
    } else {
      $(".show-more").show();
    }
    numberOfLinksShowing = links.length
    $(".links-list").empty();
    links.map(function(link) {
      var linkElement = "<li data-id='" + link.id + "' class='list-group-item link'>"  + 
                          "<span class='vote-total'>" + link.voteTotal + "</span>" +
                          "<span class='glyphicon glyphicon-triangle-top up vote' data-val='1'></span>"   +
                          "<span class='glyphicon glyphicon-triangle-bottom down vote' data-val='-1'></span>"   +
                          "<a href='" + link.url + "'></a><br>" + 
                          "<span class='submitters'>submitted by:</span>"         + 
                        "</li>";
      $(".links-list").append(linkElement);
    });

    $(".vote").click(function(event) {
      ll.vote($(this).parent().data().id, $(this).data().val);
    });
  };

  ll.onLinkMetadataAdded = function(link) {
    $("[data-id='" + link.id + "']").find("a").text(link.title);
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

  $(".show-more").click(function() {
    ll.showMoreLinks();
    return false;
  })


  ll.start();

});






