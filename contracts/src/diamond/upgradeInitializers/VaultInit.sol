//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {LibDiamond} from "diamond-1-hardhat/libraries/LibDiamond.sol";
import {IDiamondCut} from "diamond-1-hardhat/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "diamond-1-hardhat/interfaces/IDiamondLoupe.sol";
import {IERC173} from "diamond-1-hardhat/interfaces/IERC173.sol";
import {IERC165} from "diamond-1-hardhat/interfaces/IERC165.sol";
import {LibVault} from "../libraries/LibVault.sol";

contract VaultInit {

    function init(uint256 minLockDuration) external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;

        LibVault.VaultStorage storage vs = LibVault.vaultStorage();
        vs.minLockDuration = minLockDuration;  
        vs.version = "1.0.0";
    }
}
