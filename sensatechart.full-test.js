var liveUpdateChartMap = [];	
var runningLiveUpdateScheduler = false;
var sensorMap = {};
var canvasSensorMap = {};
var charts  = {};
var initChartJS = false;
var apiLocation = "https://test-api.sensate.io/v1/";

loadScript("https://www.chartjs.org/dist/2.9.3/Chart.bundle.min.js", 
	function(){

		Chart.defaults.lineSensate = Chart.defaults.line;                // the name of the new chart type is "pieWithExtraStuff"

		Chart.controllers.lineSensate = Chart.controllers.line.extend({  // creating the controller for our "pieWithExtraStuff" chart by extending from the default pie chart controller
		  draw: function(ease) {                                              // override the draw method to add the extra stuff
		    Chart.controllers.pie.prototype.draw.call(this, ease);            // call the parent draw method (inheritance in javascript, whatcha gonna do?)

		    var ctx = this.chart.ctx;                                         // get the context
		    if (this.labelIconImage) { 
		      ctx.drawImage(this.labelIconImage, this.chart.width-186, 0, 186, 30);
		    }
		  },
		  initialize: function(chart, datasetIndex) {                         // override initialize too to preload the image, the image doesn't need to be outside as it is only used by this chart
		    Chart.controllers.pie.prototype.initialize.call(this, chart, datasetIndex);

		    var image = new Image();
		    image.onload = () => {                                            // when the image loads
		      this.labelIconImage = image;                                    // save it as a property so it can be accessed from the draw method
		      chart.render();                                                 // and force re-render to include it
		    };

		    image.src = "https://www.sensate.io/res/chart/pbs.png";
		  }
		});

		initChartJS = true;

	}
);


async function initChart(canvasName, accessToken, listKey, liveUpdate, min, max)
{
	console.log("initChart(canvasName, accessToken, listKey, liveUpdate, min, max)");

	while(!initChartJS)
	{
		await sleep(100);
	}

	var sensors=[];
	var i=0;

	var chartMap

	if(liveUpdate)
	{
		liveUpdateChartMap.push({
			canvas: canvasName,
			accessToken: accessToken,
			listKey: listKey
		});
	}

	loadJSON(apiLocation+"data/list?accessToken="+accessToken+"&listKey="+listKey,

         function(data) { 

         		Object.keys(data).forEach(function(key) {

					var sensorData=[];
					var value = data[key];

					var short_name  =value.shortName;
					var name        =value.name;
					var sessor_type =value.sensorType;
					var data_unit   =value.dataUnit;
					var graphcolor = "#"+value.graphColor;
					var unitShort = value.dataUnitShort;

					for(var j=0;j<value.data.length;j++)
					{
						var date = new Date(value.data[j].dateTime);

						sensorData[j]=
						{
							x: date,
							y: value.data[j].value,
						};

					}

					sensors[i]=
					{
						label: name, 
						data: sensorData,
						fill: false,
					    lineTension: 0,
					    borderColor: graphcolor,
					    backgroundColor: graphcolor,
					    unit: unitShort
					};

					sensorMap[canvasName+key] = i;

					i++;

				});

				drawChart(canvasName, sensors, min, max, liveUpdate);

         },
         
         function(xhr) { console.error(xhr); }
	);

}
		
function drawChart(canvasName, sensors, min, max, liveUpdate)
{	
	var canvas = document.getElementById(canvasName);

	var ctx = canvas.getContext('2d');

	var scaleTicks;

	canvasSensorMap[canvasName] = sensors;

	if(min!=null && max!=null)
	{
		scaleTicks = {
			max: max,
			min: min
		};		
	}
	else
		scaleTicks = {};

	var config = 
	{
		type: 'lineSensate',
		tension: 0,

		data:
		{
			datasets: sensors
		},

		options: 
		{
			bezierCurve : true,
			responsive: true,
			title: 
			{
				display: false,
				text: 'Sensate Sensor Chart'
			},

			tooltips: 
			{
				mode: 'label',
				enabled: true,
				intersect: false,
				position: 'nearest',
				callbacks: 
				{
					label: function (t, d) 
					{
						for(var j=0;j<sensors.length;j++)
						{
							if (t.datasetIndex === j ) 
							{
								var name=sensors[j].label;
								var dataunit =sensors[j].unit;
								return  " "+name+': '+t.yLabel + dataunit
							}
						}
					}
				}
			},

			hover: 
			{
				mode: 'nearest',
				intersect: true
			},
			scales: 
			{
				xAxes: [{
	                type: 'time',
	                distribution: 'linear',
	                time: {
	                	tooltipFormat: 'll HH:mm:ss',
	                	displayFormats: {
				           'millisecond': 'HH:mm:SS:sss',
				           'second': 'HH:mm:SS',
				           'minute': 'HH:mm',
				           'hour': 'HH',
				           'day': 'MMM DD',
				           'week': 'MMM DD',
				           'month': 'MMM',
				           'quarter': 'MMM DD',
				           'year': 'DD.MM.YYYY HH:mm:ss',
				        }
	                }
            	}],
				yAxes: 
				[{
					display: true,
					scaleLabel: 
					{
						display: true,
						labelString: 'Wert'
					},
					ticks: scaleTicks
				}]
			}
		}
	};

	var chart = new Chart(ctx, config);

	charts[canvasName] = chart;

	if(!runningLiveUpdateScheduler && liveUpdate)
	{
		runningLiveUpdateScheduler = true;
		setInterval(updateChart, 30000);
	}

}

function updateChart() 
{
	console.log(liveUpdateChartMap);

	Object.keys(liveUpdateChartMap).forEach(function(key) 
	{
		var accessToken = liveUpdateChartMap[key].accessToken;
		var listKey = liveUpdateChartMap[key].listKey;
		var canvas = liveUpdateChartMap[key].canvas;

		loadJSON(apiLocation+"data/live/list?accessToken="+accessToken+"&listKey="+listKey,
         
         function(data) { 

         		Object.keys(data).forEach(function(key) {

				var lastSensorData = data[key].lastData;

				var dataObject = {
					x: lastSensorData.dateTime,
					y: lastSensorData.value,
				};

				canvasSensorMap[canvas][sensorMap[canvas+key]].data.push(dataObject);

				charts[canvas].update();

			});

         },
         
         function(xhr) { console.error(xhr); }
		
		);
		
	});

}

function loadJSON(path, success, error)
{
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function()
    {
        if (xhr.readyState === XMLHttpRequest.DONE) {
            if (xhr.status === 200) {
                if (success)
                    success(JSON.parse(xhr.responseText));
            } else {
                if (error)
                    error(xhr);
            }
        }
    };
    xhr.open("GET", path, true);
    xhr.send();
}

function loadScript(url, callback){

    var script = document.createElement("script")
    script.type = "text/javascript";

    if (script.readyState){  //IE
        script.onreadystatechange = function(){
            if (script.readyState == "loaded" ||
                    script.readyState == "complete"){
                script.onreadystatechange = null;
                callback();
            }
        };
    } else {  //Others
        script.onload = function(){
            callback();
        };
    }

    script.src = url;
    document.getElementsByTagName("head")[0].appendChild(script);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}