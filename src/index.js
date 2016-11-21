//import "es5-shim";
//import "es5-shim/es5-sham";
import "babel-polyfill";
import "console-polyfill";
import React from "react";

import "./style/global.scss";
import "./style/colors.scss";
import "./style/index.scss";
import ReactDOM from "react-dom";
import AppRouter from "./router";
import {Provider} from "react-redux";
import {syncHistoryWithStore} from "react-router-redux";
import {browserHistory} from "react-router";
import {selectLocationState} from "./router/selector";
import configureStore from "./store";

// Create redux store with history
// this uses the singleton browserHistory provided by react-router
// Optionally, this could be changed to leverage a created history
// e.g. `const browserHistory = useRouterHistory(createBrowserHistory)();`
const initialState = {};
const store = configureStore(initialState, browserHistory);

// console.log("App/index: store: %o, state: %o", store, store.getState());

// Sync history and store, as the react-router-redux reducer
// is under the non-default key ("routing"), selectLocationState
// must be provided for resolving how to retrieve the "route" in the status
const history = syncHistoryWithStore(browserHistory, store, {selectLocationState: selectLocationState()});

ReactDOM.render((
    <Provider store={store}>
        <AppRouter history={history} store={store}/>
    </Provider>
), document.getElementById('app'));
