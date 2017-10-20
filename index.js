var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

import React from 'react';
import PropTypes from 'prop-types';

const firebase = require("firebase");
// Required for side-effects
require("firebase/firestore");

let localsRef = null;

let currentState = {};

export const initialize = options => {
  currentState = options.initialState || {};
  firebase.initializeApp(options.firebase);
  // Initialize Cloud Firestore through Firebase
  const db = firebase.firestore();

  // async한건데 그냥 이렇게 해도 될지..
  db.enablePersistence();

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      localsRef = db.collection('locals').doc(user.uid);
      localsRef.onSnapshot(doc => {
        if (!doc) return;
        currentState = doc.data();
        console.log('updated', JSON.stringify(currentState));
      });
    }
  });
};

const defaultMergeProps = (stateProps, firebaseProps, ownProps) => {
  return _extends({}, stateProps, firebaseProps, ownProps);
};

export const connectFirebase = ({ getInitialData, registerListeners, stateToProps, firebaseToProps, mergeProps, options }) => {
  if (typeof registerListeners === 'function') registerListeners = [registerListeners];
  stateToProps = stateToProps || (() => ({}));
  firebaseToProps = firebaseToProps || (() => ({}));
  mergeProps = mergeProps || defaultMergeProps;

  return Comp => {
    var _class, _temp;

    return _temp = _class = class extends React.PureComponent {

      constructor(props) {
        super(props);

        this.componentDidMount = () => {
          getInitialData && getInitialData(firebase, localsRef, this.props);

          this.unsubscribes = (registerListeners || []).map(f => f(firebase, localsRef));

          this.unsubscribe = firebase.firestore().collection("locals").doc(this.context.user.id).onSnapshot(doc => {
            const source = doc.metadata.hasPendingWrites ? "Local" : "Server";

            this.setState(mergeProps(stateToProps(currentState, this.props), firebaseToProps(firebase, this.props), this.props));
          });
        };

        this.componentWillUnmount = () => {
          this.unsubscribe();
          this.unsubscribes.forEach(f => f());
        };

        this.componentWillReceiveProps = nextProps => {
          this.setState(mergeProps(stateToProps(currentState, nextProps), firebaseToProps(firebase, nextProps), nextProps));
        };

        this.state = mergeProps(stateToProps(currentState, props), firebaseToProps(firebase, props), props);
      }

      render() {
        return React.createElement(Comp, this.state);
      }
    }, _class.contextTypes = {
      initialized: PropTypes.bool,
      user: PropTypes.object
    }, _temp;
  };
};

export class Provider extends React.PureComponent {
  constructor(...args) {
    var _temp2;

    return _temp2 = super(...args), this.state = {
      initialized: false,
      user: null
    }, this.componentDidMount = () => {
      this.unsubscribe = firebase.auth().onAuthStateChanged(user => {
        if (user) {
          const localUser = {
            id: user.uid,
            email: user.email,
            isAnonymous: user.isAnonymous
          };

          this.setState({
            initialized: true,
            user: localUser
          });

          const updateData = {
            user: localUser
          };
          const docRef = firebase.firestore().collection('locals').doc(user.uid);
          docRef.update(updateData).catch(err => {
            if (err.code === 'not-found') {
              docRef.set(updateData);
            }
          });
        } else {
          // 익명으로 로그인. 로컬 저장소 대신 모두 파이어베이스 사용하기 위해서 필요함
          firebase.auth().signInAnonymously();
        }
      });
    }, this.componentWillUnmount = () => {
      this.unsubscribe();
    }, _temp2;
  }

  getChildContext() {
    return _extends({}, this.state);
  }

  render() {
    const { initialized } = this.state;

    return React.createElement(
      'div',
      null,
      initialized && this.props.children
    );
  }
}
Provider.childContextTypes = {
  initialized: PropTypes.bool,
  user: PropTypes.object
};

