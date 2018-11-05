var DONATIONS_INFO_MAPPING = {
  has_donated: 'Is donor',
  donation_count: 'Donations so far'
};
var ADDRESS_INFO_MAPPING = {
  postcode: 'Postal code'
};

function displayErr(message) {
  client.interface.trigger('showNotify', { type: 'danger', message: message});
}

function displaySuc(message) {
  client.interface.trigger('showNotify', { type: 'success', message: message});
}

function unsubscribeContact(email) {
  return new Promise(function(resolve) {
    const body = {
      "api_token": '<%= iparam.identity_api_token %>',
      "email": email,
      // For now only email
      "subscription_id": 1,
    };
    const uri = '<%= iparam.identity_base_url %>' + '/api/subscriptions/unsubscribe';
    client.request.post(uri, {
      uri,
      body,
      json: true,
    })
      .then(function() {
        resolve(true);
      }, function(err) {
        if (err.status >= 400 && err.status < 500) {
          displayErr(err.response.error);
        } else {
          displayErr('Couldn\'t unsubscribe contact from email.');
        }
      });
  });
}

function unsubscribePermanently(email) {
  return new Promise(function(resolve) {
    const body = {
      "api_token": '<%= iparam.identity_api_token %>',
      "email": email,
    };
    const uri = '<%= iparam.identity_base_url %>' + '/api/subscriptions/unsubscribe_permanently';
    client.request.post(uri, {
      uri,
      body,
      json: true,
    })
      .then(function() {
        resolve(true);
      }, function(err) {
        if (err.status >= 400 && err.status < 500) {
          displayErr(err.response.error);
        } else {
          displayErr('Couldn\'t unsubscribe contact from email.');
        }
      });
  });
}

function fetchContactSubscriptions(email) {
  return new Promise(function(resolve) {
    const uri = '<%= iparam.identity_base_url %>' + '/api/subscriptions?' +
                'email=' + email + '&api_token=' + '<%= iparam.identity_api_token %>';
    client.request.get(uri, {
      uri,
      json: true
    })
      .then(function(data) {
        resolve(data.response);
      }, function(err) {
        displayErr('Error retrieving subscriptions from Identity');
      });
  });
}

function fetchContactDetails(email) {
  return new Promise(function(resolve) {
    const body = {
      "api_token": '<%= iparam.identity_api_token %>',
      "email": email
    };
    const headers = {
      "Content-Type":"application/json"
    };
    const uri = '<%= iparam.identity_base_url %>' + '/api/member/details';
    client.request.post(uri, {
      uri,
      headers,
      body,
      json: true
    })
      .then(function(data) {
        resolve(data.response);
      }, function(err) {
        displayErr('Error fetching contact from Identity');
      });
  });
}

function getTicketContact() {
  return new Promise(function(resolve) {
    client.data.get('contact')
    .then(function(data) {
      resolve(data);
    }, function() {
      displayErr('Error fetching contact from FreshDesk');
    });
  });
}

function displayInfo(title, data) {
  jQuery('#contact-info')
  .append('<div class="fw-content-list">\
            <div class="muted">' +
              title +
            '</div>\
            <div>' +
              data +
            '</div>\
          </div>');
}

$(document).ready( function() {
  async.waterfall([
    function(callback) {
      app.initialized()
      .then(function(_client) {
        window.client = _client;
        callback();
      });
    },

    function(callback) {
      // Get the contact information through data API
      getTicketContact()
      .then(function(contactInformation) {
        callback(null, contactInformation);
      });
    },

    function(contactInformation, callback) {
      fetchContactDetails(contactInformation.contact.email)
        .then(function(crmContactInformation) {
          if (Object.keys(crmContactInformation).length > 0) {
            callback(null, crmContactInformation);
          }
          else {
            jQuery('#contact-info')
            .append('<div class="fw-content-list"><div class="muted">Contact not found</div></div>');
          }
        });
    },

    function(crmContactInformation, callback) {
      const created_at = moment(crmContactInformation.created_at);
      const now = moment();
      const member_since = moment.duration(now.diff(created_at));
      displayInfo('Member since', `${member_since.years()} year(s) ${member_since.months()} month(s) ${member_since.days()} day(s)`);

      jQuery('#contact-info').append('<div class="fw-divider"></div>');
      for (var addressKey in ADDRESS_INFO_MAPPING) {
        displayInfo(ADDRESS_INFO_MAPPING[addressKey], crmContactInformation.address[addressKey]);
      }

      jQuery('#contact-info').append('<div class="fw-divider"></div>');
      for (var donationKey in DONATIONS_INFO_MAPPING) {
        displayInfo(DONATIONS_INFO_MAPPING[donationKey], crmContactInformation.donations[donationKey]);
      }

      callback(null, crmContactInformation);
    },

    function(crmContactInformation, callback) {
      fetchContactSubscriptions(crmContactInformation.email)
      .then(function(subscriptions) {
        if (subscriptions.length > 0) {
          callback(null, subscriptions, crmContactInformation);
        }
        else {
          jQuery('#contact-info')
            .append('<div class="fw-content-list"><div class="muted">Contact has no subscriptions.</div></div>');
          jQuery('#unsubscribe').hide();
        }
      });
    },

    function(subscriptions, crmContactInformation, callback) {
      const emailSub = subscriptions.find((sub) => sub.subscription_id === 1);
      if (emailSub === undefined) {
        jQuery('#contact-info')
          .append('<div class="fw-content-list"><div class="muted">Contact has no email subscription.</div></div>');
      } else if(emailSub.unsubscribed_at) {
        $("#unsub-email").css("display", "inline-block");
        jQuery("#unsub-email").attr('disabled', true);
      } else {
        $("#unsub-email").css("display", "inline-block");
        jQuery("#unsub-email").click(function() {
          unsubscribeContact(crmContactInformation.email)
          .then(function(succ) {
            displaySuc('Successfully unsubscribed contact from email.');
            jQuery("#unsub-email").attr('disabled', true);
          });
        });
      }

      const permaSub = subscriptions.find((sub) => sub.permanent === true);
      if(permaSub) {
        $("#unsub-perma").css("display", "inline-block");
        jQuery("#unsub-perma").attr('disabled', true);
      } else {
        $("#unsub-perma").css("display", "inline-block");
        jQuery("#unsub-perma").click(function() {
          unsubscribePermanently(crmContactInformation.email)
          .then(function(succ) {
            displaySuc('Permanently unsubscribed contact.');
            jQuery("#unsub-perma").attr('disabled', true);
            jQuery("#unsub-email").attr('disabled', true);
          });
        });
      }
    }

  ]);
});
