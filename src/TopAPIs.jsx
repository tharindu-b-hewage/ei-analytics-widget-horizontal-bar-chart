import React, {Component} from 'react';
import Widget from '@wso2-dashboards/widget';
import VizG from 'react-vizgrammar';
import moment from 'moment';

var BAR_GRAPH_TYPE = 'Component Type Selection';
var URL_PARAMETER_ID = 'id';
var DIV_ID_GRAPH = 'graph';
var PUBLISHER_DATE_TIME_PICKER = 'granularity';
var TENANT_ID = '-1234';

class TopAPIs extends Widget {
    constructor(props) {
        super(props);

        // Set title according to the graph style
        this.props.glContainer.setTitle(
            "TOP " + props.configs.options[BAR_GRAPH_TYPE].toUpperCase() + "S BY REQUEST COUNT"
        );

        var config = {
            "x": 'Name',
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

        this.state = {
            graphConfig: config,
            graphMetadata: metadata,
            graphData: data,
            graphWidth: props.width,
            graphHeight: props.height,
            graphType: props.configs.options[BAR_GRAPH_TYPE],
            clearGraph: true,
            timeFromParameter: null,
            timeToParameter: null,
            timeUnitParameter: null
        };

        this.props.glContainer.on('resize', this.handleResize.bind(this));

        this.handlePublisherParameters = this.handlePublisherParameters.bind(this);
        this.handleGraphUpdate = this.handleGraphUpdate.bind(this);
        this.handleStats = this.handleStats.bind(this);
    }

    handleResize() {
        this.setState({width: this.props.glContainer.width, height: this.props.glContainer.height});
    }

    componentWillMount() {
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

                let graphType = this.state.graphType;
                let aggregator;
                if (graphType === 'API' || graphType === 'Proxy Service' || graphType === 'Inbound Endpoint') {
                    aggregator = 'ESBStat';
                }
                else {
                    aggregator = 'MediatorStat';
                }

                // Insert required parameters to the query string
                let formattedQuery = query
                    .replace("{{aggregator}}", aggregator)
                    .replace("{{componentType}}", "\'" + graphType + "\'")
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
            // Filter well known components
            let excludeEndpoints;
            switch (this.state.graphType) {
                case 'Endpoints':
                    excludeEndpoints = ["AnonymousEndpoint"];
                    break;
                case 'Sequence':
                    excludeEndpoints = ["PROXY_INSEQ", "PROXY_OUTSEQ", "PROXY_FAULTSEQ", "API_OUTSEQ", "API_INSEQ",
                        "API_FAULTSEQ", "AnonymousSequence", "fault"];
                    break;
                default:
                    excludeEndpoints = [];
            }
            let validity = excludeEndpoints.indexOf(dataPoint[labelMapper.componentName]) == -1 ? true : false;
            if (validity) {
                data.push(
                    [dataPoint[labelMapper.componentName], dataPoint[labelMapper.totalInvocations]]
                );
            }
        });

        // Draw the graph with received stats only if data is present after filtering
        if (data.length > 0) {
            this.setState({
                graphData: data,
                clearGraph: false
            });
        }
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

    handleGraphOnClick(message) {
        let clickedComponentName = message.Name;
        let urlString = window.location.href;
        let pageNameStartIndex = urlString.lastIndexOf('/');
        let pageNameEndIndex = urlString.indexOf('?');
        let redirectPageName;
        switch (this.state.graphType) {
            case 'API':
                redirectPageName = 'api';
                break;
            case 'Endpoint':
                redirectPageName = 'endpoint';
                break;
            case 'Sequence':
                redirectPageName = 'sequence';
                break;
            case 'Mediator':
                redirectPageName = 'mediator';
                break;
            case 'Proxy Service':
                redirectPageName = 'proxy';
                break;
            case 'Inbound Endpoint':
                redirectPageName = 'inbound';
                break;
            default:
                redirectPageName = '';
        }
        let formattedString =
            urlString.substring(0, pageNameStartIndex + 1) + redirectPageName + urlString.substring(pageNameEndIndex, -1);

        let redirectUrl = new URL(formattedString);
        redirectUrl.searchParams.append(URL_PARAMETER_ID, clickedComponentName);

        window.location.href = redirectUrl.toString();
    }

    /**
     * Draw the graph with parameters from the widget state
     *
     * @returns {*} A VizG graph component with the required graph
     */
    drawGraph() {
        console.log("Graph Config:", this.state.graphConfig);
        return <VizG
            theme={this.props.muiTheme.name}
            config={this.state.graphConfig}
            data={this.state.graphData}
            metadata={this.state.graphMetadata}
            onClick={this.handleGraphOnClick.bind(this)}
            height={this.props.glContainer.height}
            width={this.props.glContainer.width}
        />;
    }

    render() {
        return (
            <div>
                <div id={DIV_ID_GRAPH}>
                    {this.state.clearGraph ? this.getEmptyRecordsText() : this.drawGraph()}
                </div>
            </div>
        );
    }
}

global.dashboard.registerWidget('TopAPIs', TopAPIs);