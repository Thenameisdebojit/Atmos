// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFunctionsRouter {
    mapping(bytes32 => bool) public pendingRequests;
    
    event RequestSent(bytes32 indexed requestId);
    event RequestFulfilled(bytes32 indexed requestId);

    function sendRequest(
        uint64,
        bytes memory,
        uint16,
        uint32,
        bytes32
    ) external returns (bytes32 requestId) {
        requestId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
        pendingRequests[requestId] = true;
        emit RequestSent(requestId);
        return requestId;
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) external {
        require(pendingRequests[requestId], "Request not found");
        pendingRequests[requestId] = false;
        emit RequestFulfilled(requestId);
    }
}
