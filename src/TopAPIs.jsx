import React, {Component} from 'react';
import Widget from '@wso2-dashboards/widget';
import VizG from 'react-vizgrammar';
import moment from 'moment';

var DIV_ID_GRAPH = 'graph';
var PUBLISHER_DATE_TIME_PICKER = 'granularity';
var TENANT_ID = '-1234';

class TopAPIs extends Widget {
    constructor(props) {
        super(props);

        this.state = {
            graphConfig: {},
            graphMetadata: {},
            graphData: {},
            graphWidth: props.width,
            graphHeight: props.height,
            clearGraph: true,
            timeFromParameter: null,
            timeToParameter: null,
            timeUnitParameter: null
        };

        this.handlePublisherParameters = this.handlePublisherParameters.bind(this);
        this.handleGraphUpdate = this.handleGraphUpdate.bind(this);
        this.handleStats = this.handleStats.bind(this);
    }

    componentWillMount() {
        let config = {
            "x": "Name",
            "charts": [
                {
                    "type": "bar",
                    "y": "Requests",
                    "fill": "#00ace6",
                    "orientation": "left"
                }
            ],
            "legend": false,
            "append": false,
            "disableVerticalGrid": true,
            "disableHorizontalGrid": true,
            "animate": true
        };

        let metadata = {
            "names": [
                "Name",
                "Requests"
            ],
            "types": [
                "ordinal",
                "linear"
            ]
        }

        let data = [
            ['TestAPI1', 50],
            ['TestAPI2', 43],
        ];

        this.setState({
            graphConfig: config,
            graphMetadata: metadata,
            graphData: data
        });

        super.subscribe(this.handlePublisherParameters);
    }

    /**
     * Handle published messages from the subscribed widgets in the dashboard to extract required parameters
     *
     * @param message JSON object coming from the subscribed widgets
     */
    handlePublisherParameters(message) {
        if (PUBLISHER_DATE_TIME_PICKER in message) {
            // Update time parameters and clear existing graph
            this.setState({
                timeFromParameter: moment(message.from).format("YYYY-MM-DD HH:mm:ss"),
                timeToParameter: moment(message.to).format("YYYY-MM-DD HH:mm:ss"),
                timeUnitParameter: message.granularity,
                clearGraph: true
            }, this.handleGraphUpdate);
        }
    }

    /**
     * Update graph parameters according to the updated publisher widget parameters
     */
    handleGraphUpdate() {
        //console.log('A');
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {

                // Get data provider sub json string from the widget configuration
                let dataProviderConf = this.getProviderConf(message.data);
                var query = dataProviderConf.configs.config.queryData.query;

                // Insert required parameters to the query string
                let formattedQuery = query
                    .replace("{{tenantId}}", TENANT_ID)
                    .replace("{{timeFrom}}", "\'" + this.state.timeFromParameter + "\'")
                    .replace("{{timeTo}}", "\'" + this.state.timeToParameter + "\'")

                dataProviderConf.configs.config.queryData.query = formattedQuery;

                // Request datastore with the modified query
                super.getWidgetChannelManager()
                    .subscribeWidget(
                        this.props.id, this.handleStats, dataProviderConf
                    );
            })
            .catch((error) => {
               // console.log(error);
            });
    }

    getProviderConf(widgetConfiguration) {
        return widgetConfiguration.configs.providerConfig;
    }

    /**
     * Draw the graph with the data retrieved from the data store
     */
    handleStats(stats) {
       // console.log(JSON.stringify(stats));

        // For each data point(Ex: For each API), an array of [total invocations, component name of that data point]
        let dataPointArray = stats.data;

        // index and label mapping of each element in a data point
        let labelMapper = {};
        stats.metadata.names.forEach((value, index) => {
            labelMapper[value] = index;
        })

        // Build data for the graph
        let data = [];
        dataPointArray.forEach((dataPoint) => {
            data.push(
                [dataPoint[labelMapper.componentName], dataPoint[labelMapper.totalInvocations]]
            );
        });

        // Draw the graph with received stats
        this.setState({
            graphData: data,
            clearGraph: false
        });
    }

    /**
     * Return notification message when required parameters to draw the graph are not available
     *
     * @returns {*} <div> element containing the notification message
     */
    getEmptyRecordsText() {
        return (
            <div class="status-message" style={{color: 'white', marginLeft: 'auto', marginRight: 'auto'}}>
                <div class="message message-info">
                    <h4><i class="icon fw fw-info"></i> No records found</h4>
                    <p>Please select a valid date range to view stats.</p>
                </div>
            </div>
        );
    };

    /**
     * Draw the graph with parameters from the widget state
     *
     * @returns {*} A VizG graph component with the required graph
     */
    drawGraph() {
        return <VizG theme={'dark'} config={this.state.graphConfig} data={this.state.graphData}
                     metadata={this.state.graphMetadata}/>;
    }

    render() {
        return (
            <div id={DIV_ID_GRAPH} style={{width: this.state.graphWidth * 1, height: this.state.graphHeight * 1}}>
                {this.state.clearGraph ? this.getEmptyRecordsText() : this.drawGraph()}
            </div>
        );
    }
}

global.dashboard.registerWidget('TopAPIs', TopAPIs);