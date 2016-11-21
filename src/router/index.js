/**
 * Created by ZhuGongpu on 16/4/24.
 */
import React from "react";
import {Router, Route} from "react-router";
import App from "../containers/App";
import Counter from "../containers/Counter";

export default ({history, store}) => {
    return <Router history={history}>
        <Route path="/" component={App}/>
        <Route path="/counter" component={Counter}/>
    </Router>
};
