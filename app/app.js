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

    function(crmContactInformation) {
      const created_at = moment(crmContactInformation.created_at)
      const now = moment();
      const member_since = moment.duration(now.diff(created_at));
      displayInfo('Member since', `${member_since.years()} year(s) ${member_since.months()} month(s)`);

      jQuery('#contact-info').append('<div class="fw-divider"></div>');
      for (var addressKey in ADDRESS_INFO_MAPPING) {
        displayInfo(ADDRESS_INFO_MAPPING[addressKey], crmContactInformation.address[addressKey]);
      }

      jQuery('#contact-info').append('<div class="fw-divider"></div>');
      for (var donationKey in DONATIONS_INFO_MAPPING) {
        displayInfo(DONATIONS_INFO_MAPPING[donationKey], crmContactInformation.donations[donationKey]);
      }
    }
  ]);
});
