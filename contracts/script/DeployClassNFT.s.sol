// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {ClassNFT} from "../src/nft/ClassNFT.sol";

contract DeployClassNFT is Script {
    function run() external returns (ClassNFT nft) {
        vm.startBroadcast();
        nft = new ClassNFT();
        vm.stopBroadcast();
    }
}
