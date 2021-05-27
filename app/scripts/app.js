var DONATIONS_INFO_MAPPING = {
  has_donated: 'Is donor',
  donation_count: 'Donations so far',
  last_donated: 'Last donated',
  highest_donation: 'Highest donation',
  average_donation: 'Average donation'
};
var ADDRESS_INFO_MAPPING = {
  postcode: 'Postal code'
};


var BASIC_AUTH = "Basic <%= encode('api_user' + ':' + iparam.identity_api_token) %>";

function displayErr(message) {
  client.interface.trigger('showNotify', { type: 'danger', message: message});
}

function displaySuc(message) {
  client.interface.trigger('showNotify', { type: 'success', message: message});
}

function unsubscribeContact(email) {
  return new Promise(function(resolve) {
    const body = {
      "email": email,
      // For now only email
      "subscription_id": 1,
    };
    const headers = {
      'Authorization': BASIC_AUTH,
      "Content-Type":"application/json"
    };
    const uri = 'https://' + '<%= iparam.identity_base_url %>' + '/api/subscriptions/unsubscribe';
    client.request.post(uri, {
      uri,
      headers,
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
      "email": email,
    };
    const headers = {
      'Authorization': BASIC_AUTH,
      "Content-Type":"application/json"
    };
    const uri = 'https://' + '<%= iparam.identity_base_url %>' + '/api/subscriptions/unsubscribe_permanently';
    client.request.post(uri, {
      uri,
      headers,
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
    const uri = 'https://' + '<%= iparam.identity_base_url %>' + '/api/subscriptions?' +
                'email=' + email;
    const headers = {
      'Authorization': BASIC_AUTH,
      "Content-Type":"application/json"
    };
    client.request.get(uri, {
      uri,
      headers,
      json: true
    })
      .then(function(data) {
        resolve(data.response);
      }, function() {
        displayErr('Error retrieving subscriptions from Identity');
      });
  });
}

function fetchContactDetails(email) {
  return new Promise(function(resolve) {
    const body = {
      "email": email
    };
    const headers = {
      'Authorization': BASIC_AUTH,
      "Content-Type":"application/json"
    };
    const uri = 'https://' + '<%= iparam.identity_base_url %>' + '/api/member/details';
    client.request.post(uri, {
      uri,
      headers,
      body,
      json: true
    })
      .then(function(data) {
        resolve(data.response);
      }, function() {
        console.error(uri,headers,body);
        displayErr('FD-Identity connection issue');
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
      }).catch(function () {
        console.log("Cannot initialize");
        displayErr("Cannot initialize Identity->Freshdesk integration");
      });
    },

    function(callback) {
      // Get the contact information through data API
      getTicketContact()
      .then(function(contactInformation) {
        callback(null, contactInformation);
      }).catch(function () {
        console.log("Ticket contact not received for:");
        console.log(contactInformation);
        displayErr("No contact for ticket");
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
        }).catch(function () {
          console.log("No contact in CRM for:" + contactInformation.contact.email);
          displayErr("No contact in CRM for:" + contactInformation.contact.email);
        });
    },

    function(crmContactInformation, callback) {
      console.log(crmContactInformation);
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
      }).catch(function () {
        console.log("No subscription in CRM for:" + crmContactInformation.email);
        displayErr("No subscription in Identity for:" + contactInformation.contact.email);
      });
    },

    function(subscriptions, crmContactInformation) {
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
          .then(function() {
            displaySuc('Successfully unsubscribed contact from email.');
            jQuery("#unsub-email").attr('disabled', true);
          }).catch(function () {
            console.log("Cannot unsubscribe from email from CRM for:" + crmContactInformation.email);
            displayErr("Cannot unsubscribe from email in Identity:" + contactInformation.contact.email);
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
          .then(function() {
            displaySuc('Permanently unsubscribed contact.');
            jQuery("#unsub-perma").attr('disabled', true);
            jQuery("#unsub-email").attr('disabled', true);
          }).catch(function () {
            console.log("Cannot permanently unsubscribe from CRM for:" + crmContactInformation.email);
            displayErr("Cannot permanently unsubscribe from Identity:" + contactInformation.contact.email);
          });
        });
      }
    }

  ]);
});
