/* global THREE */
'use strict';

function Viewpoint(camera) {
  this.camera = camera;
  // after initialization 'followedObject' contains the id ('n<id>') of the followed node or 'none' if no object is followed
  this.followedObject = null;
  // If the followed object has moved since the last time we updated the viewpoint position, this field will contain a
  // vector with the translation applied to the object.
  this.followedObjectDeltaPosition = null;
  this.viewpointMass = 1.0; // Mass of the viewpoint used during the object following algorithm.
  this.viewpointFriction = 0.05; // Friction applied to the viewpoint whenever it is going faster than the followed object.
  this.viewpointForce = null; // Vector with the force that will be applied to the viewpoint for the next delta T.
  this.viewpointVelocity = null; // Current velocity of the viewpoint.
  this.viewpointLastUpdate = undefined; // Last time we updated the position of the viewpoint.
};

Viewpoint.prototype = {
  constructor: Viewpoint,

  reset: function(time) {
    this.camaera.position.copy(this.initialViewpointPosition);
    this.camaera.quaternion.copy(this.view.initialViewpointOrientation);
    this.updateViewpointPosition(true, time);
  },

  resetFollow: function() {
    this.followedObject = null;
  },

  initFollowParameters: function() {
    this.initialViewpointPosition = this.camera.position;
    this.initialViewpointOrientation = this.camera.quaternion;
    if (this.camera.userData.followSmoothness !== null)
      this.setViewpointMass(this.camera.userData.followSmoothness);
    if (this.camera.userData.followedId != null) {
      this.followedObject = this.camera.userData.followedId;
      this.follow(this.camera.userData.followedId);
    } else
      this.follow.followedObject = 'none';
  },

  follow: function(object) {
    this.followedObject = object;
    this.viewpointForce = new THREE.Vector3(0.0, 0.0, 0.0);
    this.viewpointVelocity = new THREE.Vector3(0.0, 0.0, 0.0);
  },

  setViewpointMass: function(mass) {
    this.viewpointMass = mass;
    if (this.viewpointMass <= 0.05)
      this.viewpointMass = 0.0;
    else {
      if (this.viewpointMass > 1.0)
        this.viewpointMass = 1.0;
      this.friction = 0.05 / this.viewpointMass;
    }
  },

  setFollowedObjectDeltaPosition: function(newPosition, previousPosition) {
    this.followedObjectDeltaPosition = new THREE.Vector3();
    this.followedObjectDeltaPosition.subVectors(newPosition, previousPosition);
  },

  updateViewpointPosition: function(forcePosition, time) {
    if (this.followedObject == null || this.followedObject === 'none' || time === undefined)
      return;
    if (this.viewpointLastUpdate === undefined)
      this.viewpointLastUpdate = time;

    var timeInterval = Math.abs(time - this.viewpointLastUpdate) / 1000;

    if (timeInterval > 0 && this.camera) {
      this.viewpointLastUpdate = time;
      var viewpointPosition = this.camera.position;
      var viewpointDeltaPosition = null;
      if (this.followedObjectDeltaPosition != null)
        this.viewpointForce.add(this.followedObjectDeltaPosition);

      // Special case: if the mass is 0 we simply move the viewpoint to its equilibrium position.
      // If timeInterval is too large (longer than 1/10 of a second), the progression won't be smooth either way,
      // so in this case we simply move the viewpoint to the equilibrium position as well.
      if (forcePosition || this.viewpointMass === 0 || (timeInterval > 0.1 && this.animation == null)) {
        viewpointDeltaPosition = this.viewpointForce.clone();
        this.viewpointVelocity = new THREE.Vector3(0.0, 0.0, 0.0);
      } else {
        var acceleration = this.viewpointForce.clone();
        acceleration.multiplyScalar(timeInterval / this.viewpointMass);
        this.viewpointVelocity.add(acceleration);
        var scalarVelocity = this.viewpointVelocity.length();

        // Velocity of the object projected onto the velocity of the viewpoint.
        var scalarObjectVelocityProjection;
        if (this.followedObjectDeltaPosition != null) {
          var objectVelocity = this.followedObjectDeltaPosition.clone();
          objectVelocity.divideScalar(timeInterval);
          scalarObjectVelocityProjection = objectVelocity.dot(this.viewpointVelocity) / scalarVelocity;
        } else
          scalarObjectVelocityProjection = 0;

        // The viewpoint is going "faster" than the object, to prevent oscillations we apply a slowing force.
        if (this.viewpointFriction > 0 && scalarVelocity > scalarObjectVelocityProjection) {
          // We apply a friction based on the extra velocity.
          var velocityFactor = (scalarVelocity - (scalarVelocity - scalarObjectVelocityProjection) * this.viewpointFriction) / scalarVelocity;
          this.viewpointVelocity.multiplyScalar(velocityFactor);
        }
        viewpointDeltaPosition = this.viewpointVelocity.clone();
        viewpointDeltaPosition.multiplyScalar(timeInterval);
      }
      var viewpointNewPosition = new THREE.Vector3();
      viewpointNewPosition.addVectors(viewpointPosition, viewpointDeltaPosition);
      this.viewpointForce.sub(viewpointDeltaPosition);
      this.camera.position.copy(viewpointNewPosition);
      this.followedObjectDeltaPosition = null;
    }
  }
};
