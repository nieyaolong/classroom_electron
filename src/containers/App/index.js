/**
 * Created by ZhuGongpu on 16/4/21.
 */
import React from "react";
import "./index.scss";
import {connect} from "react-redux";
import {Link} from "react-router";

class App extends React.Component {
    render() {
        return <div className="main-content">
            <Link to="/counter">Counter</Link>
        </div>
    }
}

export default connect()(App)