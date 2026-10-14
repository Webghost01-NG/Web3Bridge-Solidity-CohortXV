//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Script, console} from "forge-std/Script.sol";
import {Diamond, DiamondArgs} from "diamond-1-hardhat/Diamond.sol";
import {IDiamond} from "diamond-1-hardhat/interfaces/IDiamond.sol";
import {VaultSelectors} from "../src/diamond/VaultSelectors.sol";
import {SavingsFacet} from "../src/diamond/facets/SavingsFacet.sol";
import {VaultInit} from "../src/diamond/upgradeInitializers/VaultInit.sol";
import {OwnershipFacet} from "diamond-1-hardhat/facets/OwnershipFacet.sol";
import {DiamondLoupeFacet} from "diamond-1-hardhat/facets/DiamondLoupeFacet.sol";
import {DiamondCutFacet} from "diamond-1-hardhat/facets/DiamondCutFacet.sol";

contract DeployVaultDiamond is Script {
    function run() external returns (address vault) {
        address owner = vm.envAddress("OWNER");
        uint256 minLock = vm.envOr("MIN_LOCK", uint256(60));

        vm.startBroadcast();

        // Deploy facets
        DiamondCutFacet cutFacet = new DiamondCutFacet();
        DiamondLoupeFacet loupeFacet = new DiamondLoupeFacet();
        OwnershipFacet ownershipFacet = new OwnershipFacet();
        SavingsFacet savingsFacet = new SavingsFacet();

        VaultInit vaultInit = new VaultInit();

        // Describing the first cut
        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](4);

        cut[0] = IDiamond.FacetCut({
            facetAddress: address(cutFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: VaultSelectors.diamondCut()
        });
        cut[1] = IDiamond.FacetCut({
            facetAddress: address(loupeFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: VaultSelectors.diamondLoupe()
        });
        cut[2] = IDiamond.FacetCut({
            facetAddress: address(ownershipFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: VaultSelectors.ownership()
        });
        cut[3] = IDiamond.FacetCut({
            facetAddress: address(savingsFacet),
            action: IDiamond.FacetCutAction.Add,
            functionSelectors: VaultSelectors.savings()
        });

        // Deploy the diamond
        DiamondArgs memory args = DiamondArgs({owner: owner, init: address(vaultInit), initCalldata: abi.encodeWithSelector(VaultInit.init.selector, minLock)});
        Diamond diamond = new Diamond(cut, args);

        vm.stopBroadcast();

        vault = address(diamond);
        console.log("DiamondCut deployed to:", address(cutFacet));
        console.log("DiamondLoupe deployed to:", address(loupeFacet));
        console.log("OwnershipFacet deployed to:", address(ownershipFacet));
        console.log("SavingsFacet deployed to:", address(savingsFacet));
        console.log("VAULT (Diamond) deployed to:", vault);

    }
}
