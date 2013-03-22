var Gearman = require('../gearman.js').Gearman;
var packet_types = require('../gearman.js').packet_types;
require('buffertools');
var put = require('put');

exports.setUp = function (callback) {
        this.g = new Gearman();
        callback();
};

exports.tearDown = function (callback) {
    // clean up
    this.g.close();
    this.g = null;
  
    callback();
};


// passing something other than a buffer should throw an error
exports.testInvalidInputBuffer = function(test){
	test.throws(function(){
		this.g._decodePacket();
	});
	test.throws(function(){
		this.g._decodePacket('');
	});
	test.throws(function(){
		this.g._decodePacket(null);
	});
	test.throws(function(){
		this.g._decodePacket(undefined_var);
	});
	test.throws(function(){
		this.g._decodePacket({});
	});
	test.throws(function(){
		this.g._decodePacket(function(){});
	});

	test.throws(function(){
		this.g._decodePacket(023);
	});
	test.done();
};

exports.testMagicHeader = function(test){
	// test a bad header
	test.throws(function(){
		var bad_buffer = new Buffer([0x00, 0x00, 0x45, 0x51, 0, 0, 0, 3, 0, 0, 0, 0]);
		this.g._decodePacket(bad_buffer);
	});

	// test 2 good headers (REQ and RES)
	var good_buffer1 = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, packet_types.RESET_ABILITIES, 0, 0, 0, 0]);
	var result = this.g._decodePacket(good_buffer1);
	test.equal(result.type, packet_types.RESET_ABILITIES, 'REQ magic header fails');
	var good_buffer2 = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, packet_types.RESET_ABILITIES, 0, 0, 0, 0]);
	result = this.g._decodePacket(good_buffer1);
	test.equal(result.type, packet_types.RESET_ABILITIES, 'RES magic header fails');

	test.done();
};


exports.testInvalidPacketType = function(test){
	// passing an invalid packet type should throw an exception
	var bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 0, 0, 0, 0, 0 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	// passing an invalid packet type should throw an exception
	bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 37, 0, 0, 0, 0 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	test.done();
};

exports.testValidPacketType = function(test){
	var good_buffer = null, result = null;

	// validate all the valid packet types result in a buffer
	for(var p_type=1; p_type< 37; p_type++)
	{
		good_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, p_type, 0, 0, 0, 0]);
		result = this.g._decodePacket(good_buffer);
		test.equal(result.type, p_type, 'packet type ' + p_type + ' failed to decode');
	}

	test.done();
};

exports.testInvalidPacketSize = function(test){
	// passing an invalid packet size should throw an exception
	var bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 3, 0, 0, 0, 1 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	// passing an invalid packet type should throw an exception
	bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 3, 0, 0, 0, 0x04 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	test.done();
};

exports.testValidPacketSize = function(test){
	// passing an invalid packet size should throw an exception
	var bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 3, 0, 0, 0, 1, 0x45 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	// passing an invalid packet type should throw an exception
	bad_buffer = new Buffer([0x00, 0x52, 0x45, 0x51, 0, 0, 0, 3, 0, 0, 0, 4, 0x45, 0x45, 0x45, 0x45 ]);
	test.throws(function(){
		this.g._decodePacket(bad_buffer);
	});

	test.done();
};

exports.testParsePacket = function(test){
	var good_buffer = new Buffer([ 0x74, 0x65, 0x73, 0x74, 0x20, 0x66, 0x75, 
							   0x6e, 0x63, 0x74, 0x69, 0x6f, 0x6e, 0x00, 0x00, 
							   0x74, 0x65, 0x73, 0x74, 0x20, 0x70, 0x61, 0x79, 
							   0x6c, 0x6f, 0x61, 0x64 ]);
	result = this.g._parsePacket(good_buffer, 's8s');
	test.equal(result[0], 'test function');
	test.equal(result[1], 0);
	test.equal(result[2], 'test payload');

	good_buffer = new Buffer([ 0x74 ]);
	result = this.g._parsePacket(good_buffer, '8');
	test.equal(result[0], 116);

	test.done();
};

exports.testNOOP = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.NOOP, 0, 0, 0, 0]);
	this.g.on ('NOOP', function(){
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testJOB_CREATED = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.JOB_CREATED, 0x00, 0x00, 0x00, 0x09, 0x48, 0x3a, 0x6d, 0x69, 
		0x6b, 0x65, 0x3a, 0x37, 0x37]);

	this.g.on ('JOB_CREATED', function(job_handle){
		test.equal (job_handle, 'H:mike:77');
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testJOB_ASSIGN = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.JOB_ASSIGN, 0x00, 0x00, 0x00, 0x1d, 0x48, 0x3a, 0x6d, 
		0x69, 0x6b, 0x65, 0x3a, 0x37, 0x37, 0x00, 0x75, 0x70, 0x70, 0x65, 0x72, 
		0x00, 0x48, 0x65, 0x6c, 0x6c, 0x6f, 0x2c, 0x20, 0x57, 0x6f, 0x72, 0x6c, 
		0x64, 0x21]);
	this.g.on ('JOB_ASSIGN', function(job){
		test.equal(job.func_name, 'upper');
		test.equal(job.handle, 'H:mike:77');
		test.equal(job.payload, 'Hello, World!');
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testWORK_COMPLETE = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.WORK_COMPLETE, 0x00, 0x00, 0x00, 0x17, 0x48, 0x3a, 0x6d, 
		0x69, 0x6b, 0x65, 0x3a, 0x37, 0x37, 0x00, 0x48, 0x45, 0x4c, 0x4c, 0x4f, 
		0x2c, 0x20, 0x57, 0x4f, 0x52, 0x4c, 0x44, 0x21]);
	this.g.on ('WORK_COMPLETE', function(job){
		test.equal(job.handle, 'H:mike:77');
		test.equal(job.payload, 'HELLO, WORLD!');
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testECHO_RES = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.ECHO_RES, 0x00, 0x00, 0x00, 0x19, 0x64, 0x65, 0x61, 0x64,
		0x6c, 0x69, 0x6e, 0x65, 0x73, 0x20, 0x61, 0x6e, 0x64, 0x20, 0x63, 0x6f,
		0x6d, 0x6d, 0x69, 0x74, 0x6d, 0x65, 0x6e, 0x74, 0x73]);
	this.g.on ('ECHO_RES', function(payload){
		test.equal(payload, 'deadlines and commitments');
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testNO_JOB = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.NO_JOB, 0, 0, 0, 0]);
	this.g.on ('NO_JOB', function(){
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

exports.testSTATUS_RES = function(test){
	var good_buffer = new Buffer([0x00, 0x52, 0x45, 0x53, 0, 0, 0, 
		packet_types.STATUS_RES, 0x00, 0x00, 0x00, 0x11, 0x48, 0x3a, 0x6d, 
		0x69, 0x6b, 0x65, 0x3a, 0x39, 0x39, 0x00, 0x31, 0x00, 0x30, 0x00, 0x30,
		0x00, 0x30]);
	this.g.on ('STATUS_RES', function(job){
		test.equal(job.handle, 'H:mike:99');
		test.equal(job.known, 1);
		test.equal(job.running, 0);
		test.equal(job.percent_done_num, 0);
		test.equal(job.percent_done_den, 48);
		test.done();
	});
	packet = this.g._decodePacket(good_buffer);
	this.g._handlePacket(packet);
};

//console.log ('wind', good_buffer.toString());
// NO_JOB        00 52 45 53 00 00 00 0a 00 00 00 00
// ECHO_RES      00 52 45 53 00 00 00 11 00 00 00 19 64 65 61 64 6c 69 6e 65 73 20 61 6e 64 20 63 6f 6d 6d 69 74 6d 65 6e 74 73
// NOOP          00 52 45 53 00 00 00 06 00 00 00 00
// JOB_CREATED   00 52 45 53 00 00 00 08 00 00 00 09 48 3a 6d 69 6b 65 3a 37 37
// JOB_ASSIGN    00 52 45 53 00 00 00 0b 00 00 00 1d 48 3a 6d 69 6b 65 3a 37 37 00 75 70 70 65 72 00 48 65 6c 6c 6f 2c 20 57 6f 72 6c 64 21
// WORK_COMPLETE 00 52 45 53 00 00 00 0d 00 00 00 17 48 3a 6d 69 6b 65 3a 37 37 00 48 45 4c 4c 4f 2c 20 57 4f 52 4c 44 21
// STATUS_RES    00 52 45 53 00 00 00 14 00 00 00 11 48 3a 6d 69 6b 65 3a 39 39 00 31 00 30 00 30 00 30
