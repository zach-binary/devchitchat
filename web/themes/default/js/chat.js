(function(n, win){
	function debug(level){
		console.log(arguments);
	}
	function getBase64Image(img) {
	    // Create an empty canvas element
	    var canvas = document.createElement("canvas");
	    canvas.width = img.width;
	    canvas.height = img.height;

	    // Copy the image contents to the canvas
	    var ctx = canvas.getContext("2d");
	    ctx.drawImage(img, 0, 0);

	    // Get the data-URL formatted image
	    // Firefox supports PNG and JPEG. You could check img.src to guess the
	    // original format, but be aware the using "image/jpg" will re-encode the image.
	    var dataURL = canvas.toDataURL("image/png");

	    return dataURL.replace(/^data:image\/(png|jpg);base64,/, "");
	}
	n.Events = {
		MESSAGE_WAS_SUBMITTED: 'MESSAGE_WAS_SUBMITTED',
		THIS_USER_HAS_SENT_A_MESSAGE: 'THIS_USER_HAS_SENT_A_MESSAGE',
		HAS_STARTED_TYPING: 'HAS_STARTED_TYPING',
		HAS_STOPPED_TYPING: 'HAS_STOPPED_TYPING',
		CHAT_HEIGHT_HAS_CHANGED: 'CHAT_HEIGHT_HAS_CHANGED'
	};
	
	n.MessageView = function(container, model, delegate){
		var typingTimestamp = new Date();
		var typingTimer = null;
		var editableComment = document.getElementById('editableComment');
		var defaultStyle = {
			position: container.style.position,
			top: container.style.top
		};
		function startTimer(){
			n.NotificationCenter.publish(n.Events.HAS_STARTED_TYPING, self, null);
			return new Date();
		}
		function stopTimer(){
			typingTimer = null;
			n.NotificationCenter.publish(n.Events.HAS_STOPPED_TYPING, self, null);
		}
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, field: container.querySelector("[name='message']")
			, form: container.querySelector('form')
			, button: null
			, offset: {top: container.offsetTop}
			, resize: function(viewportSize){
				//self.top = viewportSize.h - 40;
			}
			, sendMessage: function(){
				this.model.from = this.model.to;
				this.model.time = (new Date()).getTime();
				this.model.text = this.field.value; 
				this.delegate.messageWasSubmitted(this.model);
				n.NotificationCenter.publish(n.Events.THIS_USER_HAS_SENT_A_MESSAGE, this, this.model);
				if(typingTimer !== null){
					stopTimer();
				}
				typingTimestamp = new Date();
				this.model.text = '';
				this.field.value = '';
			}
			, handleEvent: function(e){
				if(this[e.type]){
					this[e.type](e);
				}
			}
			, paste: function(e){
				if(!e.clipboardData.items){
					return;
				}
				if(e.clipboardData.items.length === 0){
					return;
				}
				if(e.clipboardData.items[0].type.indexOf('image/') === -1){
					return;
				}
				e.preventDefault();
				var file = e.clipboardData.items[0].getAsFile();
	            var reader = new FileReader();
	            reader.onload = function(evt) {
					this.model.text = evt.target.result;
					this.sendMessage();
				}.bind(this);
	            reader.readAsDataURL(file);
			}
			, submit: function(e){
				e.preventDefault();
				this.sendMessage();
			}
			, keyup: function(e){
				typingTimestamp = new Date();
				if(typingTimer === null){
					typingTimer = startTimer();
				}
				if(e.keyCode === 13){
					this.button.click();
				}
				this.model.text = this.field.value;
			}
			, release: function(){
				this.field.removeEventListener('keyup', this);
				this.form.removeEventListener('submit', this);
			},
			scrolling: function scrolling(e){
				if(window.scrollY > 0){
					if(this.container.style.position !== 'fixed'){
						this.container.style.position = 'fixed';
						this.container.style.top = '0';						
					}
				}else if(this.container.style.position !== defaultStyle.position){
					this.container.style.position = defaultStyle.position;
					this.container.style.top = defaultStyle.top;
				}
			}
		};
		window.addEventListener('scroll', self.scrolling.bind(self), true);
		self.button = self.form.querySelector('button');
		Object.defineProperty(self, 'top', {
			get: function(){return parseInt(self.field.style.top.replace('px', ''), 10);}
			, set: function(v){ self.field.style.top = v+'px';}
			, enumerable: true
		});

		self.field.addEventListener("keyup", self, true);
		self.form.addEventListener('submit', self, true);
		self.form.addEventListener('paste', self, true);
		self.field.focus();
		return self;
	};
	n.ReconnectingCounterView = function(container, model, delegate){
		var self = {
			container: container,
			model: model,
			delegate: delegate,
			show: function show(){
				this.container.style.display = 'block';
			},
			hide: function hide(){
				this.container.style.display = 'none';
			},
			update: function update(key, old, v){
				if(v === 0){
					this.hide();
				}else{
					this.show();
				}
				this.container.innerHTML = v;
			}
		};
		self.model.subscribe('times', self.update.bind(self));
		return self;
	};
	n.PreviewView = function(container, model, delegate){
		var self = {
			container: container,
			model: model,
			delegate: delegate,
			text: container.querySelector('.message .text'),
			update: function update(key, old, v){
				this.text.innerHTML = v;
			},
			show: function show(){
				this.container.style.display = 'block';
			},
			hide: function hide(){
				this.container.style.display = 'none';
			}
		};
		container.style.display = 'none';
		container.style.position = 'absolute';
		container.style.top = '50px';
		container.style.right = '20px';
		self.model.subscribe('text', self.update.bind(self));
		
		n.NotificationCenter.subscribe(n.Events.HAS_STARTED_TYPING, {HAS_STARTED_TYPING: function(){
			this.show();
		}.bind(self)}, null);
		
		n.NotificationCenter.subscribe(n.Events.HAS_STOPPED_TYPING, {HAS_STOPPED_TYPING: function(){
			this.hide();
		}.bind(self)}, null);
		
		return self;
	};
	n.RosterView = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, joined: function(member){
				if(!this.model.find(function(m){
					return m.username === member.username;
				}.bind(this))){
					this.model.push(member);
				}
			}
			, left: function(member){
				this.model.remove(function(i, m){
					return m.username === member.username;
				});
			}
			, connected: function(nicknames){
				for(var name in nicknames){
					if(!this.model.find(function(m){return m.username === name;})){
						this.model.push(nicknames[name]);
					}
				}
			}
		};
		
		var parent = container.querySelector('ul');
		var template = container.querySelector('ul li:first-child');
		var joinedTemplate = Hogan.compile(template.innerHTML);
		template.style.display = 'none';
		function userJoined(key, old, v){
			if(document.getElementById(v.username)){
				return;
			}
			var elem = template.cloneNode(true);
			elem.style.display = 'block';
			elem.id = v.username;
			elem.innerHTML = joinedTemplate.render(v);
			parent.insertBefore(elem, template);
			var avatar = elem.querySelector('img');
			avatar.src = avatar.getAttribute('data-src');
		}
		function userLeft(key, old, v){
			var remove = parent.querySelector('#' + old.username);
			if(remove === null){
				return;
			}
			parent.removeChild(remove);
		}		
		self.container.style.display = 'block';
		self.model.subscribe('push', userJoined);
		self.model.subscribe('pop', userLeft);
		self.model.subscribe('remove', userLeft);
		return self;
	};
	n.DiscussionView = function(container, model, delegate){
		var self = {
			container: container
			, model: model
			, delegate: delegate
			, messageWasSubmitted: function(message){}
			, message: function(message){
				if(message && message.text && message.text.length > 0){
					if(this.delegate && this.delegate.messageWasReceived){
						this.delegate.messageWasReceived(message);
					}
					this.model.push(new n.Observable(new n.Message(message)));
				}
			}
		};
		var template = container.querySelector(".discussion li");
		var discussion = container.querySelector('.discussion');
		template.style.display = 'none';
		var messageTemplate = Hogan.compile(template.innerHTML);
		var lastTimeMessageWasSent = (new Date()).getTime();
		var hooks = [];
		var imageUrlPattern = /https?:\/\/(?:[a-z\-]+\.)+[a-z]{2,6}(?:\/[^/#?]+)+\.(?:jpg|gif|png)/ig;
		function hookForImages(message){
			if(message.isHtml){
				return message;
			}
			message.text = message.text.replace(imageUrlPattern, '<img class="external" src="$&" />');
			return message;
		}
		function hookGithubResponse(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'github list of users'){
					message.text = '<ul>';
					users.items.forEach(function(user){
						message.text += '<li><a href="' + user.html_url + '"><img class="img-circle avatar" src="' + window.location.origin + user.avatar_url + '" /></a></li>';
					});
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;
		}
		function hookListOfUsers(message){
			try{
				var users = JSON.parse(message.text);
				if(users.what === 'list of users'){
					message.text = '<ul>';
					for(key in users){
						if(!users[key].avatar) continue;
						message.text += '<li><img class="img-circle avatar" src="' + window.location.origin + users[key].avatar + '" /></a></li>';
					}
					message.text += '</ul>';
				}
			}catch(e){
			}
			return message;
		}
		function hookGsearchResultClass(message){
			if(message.text.indexOf('GsearchResultClass') === -1) return message;
			var result = JSON.parse(message.text);
			var searchResult = result.responseData.results;
			message.text = '';
			searchResult.forEach(function(s){
				message.text += '<img src="{src}" width="200" />'.replace(/{src}/, s.unescapedUrl);
			});
			return message;
		}
		function includeHttp(url){
			if(url.indexOf('http') > -1){
				return url;
			}
			return 'http://' + url;
		}
		function hookForLinks(message){
			if(imageUrlPattern.test(message.text)){
				return message;
			}
			message.text = URI.withinString(message.text, function(url){
				return '<a href="' + includeHttp(url) + '" target="_blank">' + url + '</a>';
			});
			return message;
		}
		function hookForDataImage(message){
			message.text = message.text.replace(/^data\:image(.*)/, '<img class="external" src="$&" />');
			return message;
		}
		hooks.push({execute: hookForDataImage});
		hooks.push({execute: hookForLinks});
		hooks.push({execute: hookForImages});
		hooks.push({execute: hookGsearchResultClass});
		hooks.push({execute: hookGithubResponse});
		hooks.push({execute: hookListOfUsers});
		function messageWasAdded(key, old, v){
			if(!v) return;
			if(!v.from) return;
			var originalHeight = discussion.scrollHeight;
			var lastMessage = discussion.querySelector("[data-from='" + v.from._id + "']:first-child");
			var elem = template.cloneNode(true);
			elem.setAttribute('data-from', v.from._id);
			elem.style.display = 'block';
			hooks.forEach(function(hook){
				v = hook.execute(v);
			});
			if(lastMessage === null){
				elem.innerHTML = messageTemplate.render(v);				
				var first = discussion.querySelector('.discussion li:first-child');
				if(delegate.member.username === v.from.username){
					elem.className = 'self';
				}
				var avatar = elem.querySelector('img');
				avatar.src = avatar.getAttribute('data-src');
				var time = document.createElement('li');
				time.className = 'sent';
				time.innerHTML = '<time>' + v.sent(lastTimeMessageWasSent) + '</time>';
				discussion.insertBefore(elem, first);
				discussion.insertBefore(time, first);
			}else{
				var messages = template.querySelector('.message').cloneNode(true);
				var sameUserMessage = Hogan.compile(messages.innerHTML);
				messages.innerHTML = sameUserMessage.render(v);
				lastMessage.insertBefore(messages, lastMessage.querySelector('.message'));
			}
			lastTimeMessageWasSent = v.time;
			n.NotificationCenter.publish(n.Events.CHAT_HEIGHT_HAS_CHANGED, self, discussion.scrollHeight - originalHeight);
		}
		function messageWasRemoved(key, old, v){
			var last = container.querySelector(".discussion:last-child");
			container.removeChild(last);
		}
		
		self.model.subscribe('push', messageWasAdded);
		self.model.subscribe('pop', messageWasRemoved);
		return self;
	};	

	n.Message = function(obj){
		this.text = '';
		this.to = null;
		this.from = null;
		this.time = null;
		this.room = null;
		for(var key in obj){
			this[key] = obj[key];
		}
	};
	n.Message.prototype = {
		sent: function(lastTimeSent){
  		  var date = new Date(this.time);
  		  if((this.time - lastTimeSent)/1000 > 60*1)
  		  return 'mm/dd/yyyy h:m t'.replace('mm', date.getMonth() + 1)
  		 	 .replace('dd', date.getDate() > 9 ? date.getDate() : '0' + date.getDate())
  			 .replace('yyyy', date.getFullYear())
  			 .replace('h', date.getHours() - 12 < 0 ? date.getHours() : date.getHours() - 12)
  			 .replace('m', date.getMinutes()> 9 ? date.getMinutes() : '0' + date.getMinutes())
  			 .replace('t', date.getHours() > 11 ? 'PM' : 'AM');
  		  return "";
		}
	};
	
	n.Member = function(obj){
		this.username = null;
		this.avatar = null;
		this.name = null;
		this.displayName = null;
	  for(var key in obj){
		  this[key] = obj[key];
	  }
	};
	
	var app = function(){
		var views = [];
		var message = new n.Observable(new n.Message({text: null, to: {name: win.member.displayName, username: win.member ? win.member.username : null, avatar: win.member ? win.member.avatar : null}}));
		var messages = new n.Observable.List();
		var roster = new n.Observable.List();
		var reconnecting = new n.Observable({times: 0});
		var self = {ACTIVITY_LIMIT_IN_SECONDS: 20};
		var Permissions = {
			DEFAULT: 'default'
			, GRANTED: 'granted'
			, DENIED: 'denied'
		};
		var isNotificationsOn = false;
		var reconnectingCounterView = document.createElement('div');
		reconnectingCounterView.className = 'reconnecting';
		document.body.appendChild(reconnectingCounterView);
		
		self.isActiveRightNow = true;
		self.release = function(e){
			views.forEach(function(v){
				if(v.release){
					v.release();					
				}
			});
			if(win.member){
				socket.emit('left', win.member);
				socket.removeAllListeners('connect');
				socket.removeAllListeners('nicknames');
				socket.removeAllListeners('message');
				socket.removeAllListeners('reconnect');
				socket.removeAllListeners('reconnecting');
				socket.removeAllListeners('error');
				socket.removeAllListeners('left');
			}
		};
		self.messageWasReceived = function(message){
			return message;
		};
		self.messageWasSubmitted = function(model){
			if(!model.text){
				return;
			}
			if(model.text.length === 0){
				return;
			}
			views.forEach(function(v){
				if(v.messageWasSubmitted){
					v.messageWasSubmitted(model);
				}
			});
			socket.emit('message', model.text);
		};
		self.connected = function(nicknames){
			reconnecting.times = 0;
			views.forEach(function(v){
				if(v.connected){
					v.connected(nicknames);
				}
			});
		};
		self.joined = function(member){
			views.forEach(function(v){
				if(v.joined){
					v.joined(member);
				}
			});
		};
		self.nicknames = function(nicknames){
			views.forEach(function(v){
				if(v.nicknames){
					v.nicknames(nicknames);
				}
			});
		};
		self.didShowNotification = function(e){
			setTimeout(function closeIt(){
				e.target.close();
				e.target.removeEventListener(this.didShowNotification);
			}, 5000);
		};
						
		self.message = function(message){
			if(isNotificationsOn &&
				message.from.username !== win.member.username &&
				!self.isActiveRightNow
			){
				var n = new Notification(message.from.displayName || message.from.name, {body: message.text, tag: "notifyUser", icon: message.from.avatar});
				n.addEventListener('show', self.didShowNotification.bind(self), true);
			}
			views.forEach(function(v){
				message.to = {username: win.member.username, name: win.member.displayName, avatar: win.member.avatar};
				if(v.message){
					v.message(message);
				}
			});
		};
		self.reconnect = function(protocol, flag){
			debug(0, 'reconnect->', arguments);			
		    socket.emit('nickname', win.member.username, function(exists){
		    	roster.push({username: win.member.username, name: win.member.displayName, avatar: win.member.avatar});
		    });
		};
		self.reconnecting = function(someNumber, flag){
			reconnecting.times = someNumber;
			debug(0, 'reconnecting->', someNumber, flag);			
		};
		self.error = function(){
			debug(0, 'error->', arguments);
		};
		self.left = function(member){
			views.forEach(function(v){
				if(v.left) v.left(member);
			});
			if(member === win.member.username){
				console.log("you've been disconnected from the IRC server");
			}
		};
		self.handleEvent = function(e){
			if(self[e.type]) self[e.type](e);
		};
		self.resize = function(e){
			views.forEach(function(v){
				if(v.resize) v.resize({h: e.target.document.documentElement.clientHeight, w: e.target.document.documentElement.clientWidth});
			});
		};
		self.blur = function blur(e){
			this.isActiveRightNow = false;
		};
		self.focus = function focus(e){
			this.isActiveRightNow = true;
		};
		self.requestNotificationPermission = function(){
			if(!('Notification' in window)){
				isNotificationsOn = false;
				return isNotificationsOn;
			}
			isNotificationsOn = Notification.permission === Permissions.GRANTED;
			if(Notification.permission !== Permissions.DENIED && !isNotificationsOn){
				Notification.requestPermission(function(p){
					if(p === Permissions.GRANTED){
						isNotificationsOn = true;
					}
				});
			}
		};
		self.member = win.member;
		self.activityTimestamp = new Date();
		self.requestNotificationPermission();
		var socket;
		if(win.member){
			socket = io.connect('', {query: 'username=' + win.member.username});
			socket.on('connected', self.connected);
			socket.on('left', self.left);
			socket.on('joined', self.joined);
			socket.on('nicknames', self.nicknames);
			socket.on('message', self.message);
			socket.on('reconnect', self.reconnect);
			socket.on('reconnecting', self.reconnecting);
			socket.on('error', self.error);
			var messageView = null, discussionView = null;
			views.push(discussionView = n.DiscussionView(document.getElementById('messagesView'), messages, self));
			views.push(n.RosterView(document.getElementById('rosterView'), roster, self));
			views.push(messageView = n.MessageView(document.getElementById("comment"), message, self));
			views.push(n.ReconnectingCounterView(reconnectingCounterView, reconnecting, self));
			var firstChild = discussionView.container.querySelector(".discussion li:first-child");
			var template = firstChild.cloneNode(true);
			template.style.display = 'none';
			template.className = 'self preview';
			var compiled = Hogan.compile(template.innerHTML);
			var html = compiled.render({from: win.member});
			template.innerHTML = html + '<small>Not sent yet.</small>';
			var avatar = template.querySelector('img');
			avatar.src = avatar.getAttribute('data-src');
			
			firstChild.parentNode.appendChild(template);
			views.push(n.PreviewView(template, message, self));
			
			messageView.resize({h: window.document.documentElement.clientHeight, w: window.document.documentElement.clientWidth});
			win.addEventListener('resize', self, true);

		    socket.emit('nickname', win.member.username, function(exists){
		    	roster.push({username: win.member.username, name: win.member.displayName, avatar: win.member.avatar});
		    });
			
			socket.emit('send previous messages', 'hello?', function(list){
				if(!list){
					return;
				}
				list.forEach(function(m){
					messages.push(new n.Message(m));
				});
			});

			n.NotificationCenter.subscribe(n.Events.THIS_USER_HAS_SENT_A_MESSAGE, {THIS_USER_HAS_SENT_A_MESSAGE: function(publisher, info){
				self.activityTimestamp = new Date();
			}}, messageView);
			
			n.NotificationCenter.subscribe(n.Events.CHAT_HEIGHT_HAS_CHANGED, {CHAT_HEIGHT_HAS_CHANGED: function(publisher, messageHeight) {
				if (window.scrollY <= 0)
					return;
				window.scrollTo(window.scrollX, window.scrollY + messageHeight);
			}}, discussionView);
		}
		win.addEventListener('blur', self.blur.bind(self), true);
		win.addEventListener('focus', self.focus.bind(self), true);
		win.addEventListener('unload', self.release, true);
			
		return self;
	}();
})(MM, window);