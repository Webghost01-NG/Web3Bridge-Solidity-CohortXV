//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script} from "forge-std/Script.sol";
import {IDiamond} from "diamond-1-hardhat/interfaces/IDiamond.sol";
import {IDiamondCut} from "diamond-1-hardhat/interfaces/IDiamondCut.sol";
import {EmergencyFacet} from "../src/diamond/facets/EmergencyFacet.sol";
import {VaultSelectors} from "../src/diamond/VaultSelectors.sol";

contract UpgradeEmergencyFacet is Script {
    address constant DIAMOND = 0x021299CfFC3C27bB184E4dF97023f51c8dB93398;

    function add() external {
        require(block.chainid == 11155111, "Sepolia only");
        vm.startBroadcast();
        EmergencyFacet facet = new EmergencyFacet();
        _cut(IDiamond.FacetCutAction.Add, address(facet));
        vm.stopBroadcast();
    }

    function replace() external {
        require(block.chainid == 11155111, "Sepolia only");
        vm.startBroadcast();
        EmergencyFacet facet = new EmergencyFacet();
        _cut(IDiamond.FacetCutAction.Replace, address(facet));
        vm.stopBroadcast();
    }

    function remove() external {
        require(block.chainid == 11155111, "Sepolia only");
        vm.startBroadcast();
        _cut(IDiamond.FacetCutAction.Remove, address(0));
        vm.stopBroadcast();
    }

    function _cut(IDiamond.FacetCutAction action, address facet) private {
        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](1);
        cut[0] = IDiamond.FacetCut({facetAddress: facet, action: action, functionSelectors: VaultSelectors.emergency()});
        IDiamondCut(DIAMOND).diamondCut(cut, address(0), "");
    }
}
