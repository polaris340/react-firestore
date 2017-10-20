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
  return {
    ...stateProps,
    ...firebaseProps,
    ...ownProps
  };
};

export const connectFirebase = ({getInitialData, registerListeners, stateToProps, firebaseToProps, mergeProps, options}) => {
  if (typeof registerListeners === 'function') registerListeners = [registerListeners];
  stateToProps = stateToProps || (() => ({}));
  firebaseToProps = firebaseToProps || (() => ({}));
  mergeProps = mergeProps || defaultMergeProps;


  return Comp => class extends React.PureComponent {
    static contextTypes = {
      initialized: PropTypes.bool,
      user: PropTypes.object
    };

    constructor(props) {
      super(props);

      this.state = mergeProps(
        stateToProps(currentState, props),
        firebaseToProps(firebase, props),
        props
      );
    }

    componentDidMount = () => {
      getInitialData && getInitialData(firebase, localsRef, this.props);

      this.unsubscribes = (registerListeners || []).map(f => f(firebase, localsRef));

      this.unsubscribe = firebase.firestore().collection("locals").doc(this.context.user.id)
        .onSnapshot(doc => {
          const source = doc.metadata.hasPendingWrites ? "Local" : "Server";

          this.setState(mergeProps(
            stateToProps(currentState, this.props),
            firebaseToProps(firebase, this.props),
            this.props
          ));
        });
    };

    componentWillUnmount = () => {
      this.unsubscribe();
      this.unsubscribes.forEach(f => f());
    };

    componentWillReceiveProps = nextProps => {
      this.setState(mergeProps(
        stateToProps(currentState, nextProps),
        firebaseToProps(firebase, nextProps),
        nextProps
      ));
    };

    render() {
      return <Comp {...this.state}/>;
    }
  };
};

export class Provider extends React.PureComponent {
  state = {
    initialized: false,
    user: null
  };

  static childContextTypes = {
    initialized: PropTypes.bool,
    user: PropTypes.object
  };

  getChildContext() {
    return {
      ...this.state
    };
  }

  componentDidMount = () => {
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

  };

  componentWillUnmount = () => {
    this.unsubscribe();
  };


  render() {
    const {initialized} = this.state;

    return <div>
      {initialized && this.props.children}
    </div>;
  }
}