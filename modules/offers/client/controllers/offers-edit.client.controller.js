(function() {
  'use strict';

  angular
    .module('offers')
    .controller('OffersEditController', OffersEditController);

  /* @ngInject */
  function OffersEditController($http, $timeout, $state, $stateParams, $location, leafletBoundsHelpers, OffersService, Authentication, messageCenterService, MapLayersFactory, offer, appSettings) {

    var defaultLocation = {
      // Default to Europe
      lat: 48.6908333333,
      lng: 9.14055555556,
      zoom: 4
    };

    // ViewModel
    var vm = this;

    // Expoxed to the view
    vm.offer = offer;
    vm.addOffer = addOffer;
    vm.mapLocate = mapLocate;
    vm.enterSearchAddress = enterSearchAddress;
    vm.searchAddress = searchAddress;
    vm.searchSuggestions = searchSuggestions;
    vm.searchQuery = '';
    vm.searchQuerySearching = false;
    vm.isLoading = false;

    // Leaflet
    vm.mapCenter = defaultLocation;
    vm.mapLayers = {
      baselayers: {}
    };
    vm.mapDefaults = {
      scrollWheelZoom: false,
      attributionControl: true,
      keyboard: true,
      worldCopyJump: true,
      controls: {
        layers: {
          visible: true,
          position: 'bottomleft',
          collapsed: true
        }
      }
    };

    // Make sure DOM has finished loading
    $timeout(function() {

      // Setup Leaflet map layers
      vm.mapLayers.baselayers.streets = MapLayersFactory.streets(defaultLocation);
      vm.mapLayers.baselayers.satellite = MapLayersFactory.satellite(defaultLocation);

      // Populate some variables if user ralready has an offer
      if(vm.offer && vm.offer.location) {
        vm.mapCenter.lat = parseFloat(vm.offer.location[0]);
        vm.mapCenter.lng = parseFloat(vm.offer.location[1]);
        vm.mapCenter.zoom = 16;
      }
      // Push some defaults to offer if we didn't get proper answer...
      else {
        vm.offer.maxGuests = 1;
        vm.offer.status = 'yes';
      }

      // Determine new status from URL, overrides previous status
      if($stateParams.status && jQuery.inArray( $stateParams.status, ['yes', 'maybe', 'no'] ) ) {
        vm.offer.status = $stateParams.status;
      }
    });

    function addOffer() {
      vm.isLoading = true;

      var newOffer = new OffersService({
        status: vm.offer.status,
        description: vm.offer.description,
        noOfferDescription: vm.offer.noOfferDescription,
        location: [ parseFloat(vm.mapCenter.lat), parseFloat(vm.mapCenter.lng) ],
        maxGuests: parseInt(vm.offer.maxGuests),
      });

      newOffer.$save(function(response) {
        // Done!
        vm.isLoading = false;
        $state.go('profile', {username: Authentication.user.username});
      }, function(err) {
        vm.isLoading = false;
        var errorMessage = (err.data.message) ? err.data.message : 'Error occured. Please try again.';
        messageCenterService.add('danger', errorMessage, { timeout: appSettings.flashTimeout });
      });

    }

    /**
     * Map address search
     */
    function enterSearchAddress(event) {
      if (event.which === 13) {
        event.preventDefault();
        searchAddress();
      }
    }

    /**
     * Center map to the address in query input
     */
    function searchAddress() {
      if(vm.searchQuery !== '') {
        vm.searchQuerySearching = true;

        $http
          .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + vm.searchQuery + '.json?access_token=' + appSettings.mapbox.publicKey)
          .then(function(response) {

            vm.searchQuerySearching = false;

            if(response.status === 200 && response.data.features && response.data.features.length > 0) {
              mapLocate(response.data.features[0]);
            }
            else {
              messageCenterService.add('danger', 'Cannot find that place.', { timeout: appSettings.flashTimeout });
            }
          });

      }
    }

    /**
     * Show geo location at map
     * Used also when selecting search suggestions from the suggestions list
     */
    function mapLocate(place) {

      // Show full place name at search  query
      vm.searchQuery = placeTitle(place);

      // Does the place have bounding box?
      if(place.bbox) {
        vm.mapBounds = leafletBoundsHelpers.createBoundsFromArray([
          [ parseFloat(place.bbox[1]), parseFloat(place.bbox[0]) ],
          [ parseFloat(place.bbox[3]), parseFloat(place.bbox[2]) ]
        ]);
      }

      // Does it have lat/lng?
      else if(place.center) {
        vm.mapCenter = {
          lat: parseFloat(place.center[0]),
          lng: parseFloat(place.center[1]),
          zoom: 5
        };
      }

    }

    /**
     * Search field's typeahead -suggestions
     *
     * @link https://www.mapbox.com/developers/api/geocoding/
     */
    function searchSuggestions(val) {

     return $http
       .get('//api.tiles.mapbox.com/v4/geocode/mapbox.places-v1/' + val + '.json?access_token=' + appSettings.mapbox.publicKey)
       .then(function(response) {

         vm.searchQuerySearching = false;

         if(response.status === 200 && response.data.features && response.data.features.length > 0) {

             return response.data.features.map(function(place){
               place.trTitle = placeTitle(place);
               return place;
             });

         }
         else return [];
       });

    }

    /**
     * Compile a nice title for the place, eg. "Jyväskylä, Finland"
     */
    function placeTitle(place) {
      var title = '';

      if(place.place_name) title += place.place_name;
      else if(place.text) title += place.text;

      return title;
    }

  }

})();