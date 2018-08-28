var CONTACT_INFO_MAPPING = {
  first_name: 'First name',
  email: 'Email',
  phone_number: 'Mobile'
};
var DONATIONS_INFO_MAPPING = {
  has_donated: 'Is donor',
  donation_count: 'Donations so far'
};

function displayErr(message) {
  client.interface.trigger('showNotify', { type: 'danger', message: message});
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
        console.log(err);
      });
  });
}

function getTicketContact() {
  return new Promise(function(resolve) {
    client.data.get('contact')
    .then(function(data) {
      resolve(data);
    }, function() {
      displayErr('Error fetching contact from CRM database');
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

    function(crmContactInformation) {
      for (var contactKey in CONTACT_INFO_MAPPING) {
        displayInfo(CONTACT_INFO_MAPPING[contactKey], crmContactInformation[contactKey]);
      }
      jQuery('#contact-info').append('<div class="fw-divider"></div>');
      for (var donationKey in DONATIONS_INFO_MAPPING) {
        displayInfo(DONATIONS_INFO_MAPPING[donationKey], crmContactInformation.donations[donationKey]);
      }
    }
  ]);
});
