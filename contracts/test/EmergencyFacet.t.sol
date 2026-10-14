//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Test} from "forge-std/Test.sol";
import {Diamond, DiamondArgs} from "diamond-1-hardhat/Diamond.sol";
import {IDiamond} from "diamond-1-hardhat/interfaces/IDiamond.sol";
import {IDiamondCut} from "diamond-1-hardhat/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "diamond-1-hardhat/interfaces/IDiamondLoupe.sol";
import {DiamondCutFacet} from "diamond-1-hardhat/facets/DiamondCutFacet.sol";
import {DiamondLoupeFacet} from "diamond-1-hardhat/facets/DiamondLoupeFacet.sol";
import {SavingsFacet} from "../src/diamond/facets/SavingsFacet.sol";
import {EmergencyFacet} from "../src/diamond/facets/EmergencyFacet.sol";
import {VaultInit} from "../src/diamond/upgradeInitializers/VaultInit.sol";
import {VaultSelectors} from "../src/diamond/VaultSelectors.sol";
import {VaultBase} from "../src/diamond/VaultBase.sol";

contract EmergencyFacetTest is Test {
    address vault;
    address user = makeAddr("user");

    receive() external payable {}

    function setUp() public {
        DiamondCutFacet cutFacet = new DiamondCutFacet();
        DiamondLoupeFacet loupeFacet = new DiamondLoupeFacet();
        SavingsFacet savingsFacet = new SavingsFacet();
        VaultInit init = new VaultInit();

        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](3);
        cut[0] = IDiamond.FacetCut(address(cutFacet), IDiamond.FacetCutAction.Add, VaultSelectors.diamondCut());
        cut[1] = IDiamond.FacetCut(address(loupeFacet), IDiamond.FacetCutAction.Add, VaultSelectors.diamondLoupe());
        cut[2] = IDiamond.FacetCut(address(savingsFacet), IDiamond.FacetCutAction.Add, VaultSelectors.savings());

        DiamondArgs memory args = DiamondArgs({
            owner: address(this),
            init: address(init),
            initCalldata: abi.encodeWithSelector(VaultInit.init.selector, 1 days)
        });
        vault = address(new Diamond(cut, args));
        vm.deal(user, 10 ether);
    }

    function testEmergencyWithdrawPaysUserAndOwner() public {
        _addEmergencyFacet(new EmergencyFacet());

        vm.prank(user);
        SavingsFacet(payable(vault)).deposit{value: 1 ether}(7 days);
        (, uint64 lockedUntil) = SavingsFacet(payable(vault)).savings(user);
        assertGt(lockedUntil, block.timestamp);

        uint256 ownerBefore = address(this).balance;
        vm.prank(user);
        EmergencyFacet(vault).emergencyWithdraw();

        (uint256 amount, uint64 unlockTime) = SavingsFacet(payable(vault)).savings(user);
        assertEq(user.balance, 9.9 ether);
        assertEq(address(this).balance, ownerBefore + 0.1 ether);
        assertEq(amount, 0);
        assertEq(unlockTime, 0);
        assertEq(SavingsFacet(payable(vault)).totalSaved(), 0);
    }

    function testAddReplaceAndRemove() public {
        EmergencyFacet firstFacet = new EmergencyFacet();
        _addEmergencyFacet(firstFacet);
        assertEq(_emergencyFacetAddress(), address(firstFacet));

        EmergencyFacet secondFacet = new EmergencyFacet();
        _cut(IDiamond.FacetCutAction.Replace, address(secondFacet));
        assertEq(_emergencyFacetAddress(), address(secondFacet));

        _cut(IDiamond.FacetCutAction.Remove, address(0));
        assertEq(_emergencyFacetAddress(), address(0));
        (bool ok,) = vault.call(abi.encodeCall(EmergencyFacet.emergencyWithdraw, ()));
        assertFalse(ok);
    }

    function testTransferFailureKeepsSavings() public {
        _addEmergencyFacet(new EmergencyFacet());
        RejectEther rejectEther = new RejectEther();
        vm.deal(address(rejectEther), 1 ether);
        rejectEther.deposit{value: 1 ether}(vault);

        vm.expectRevert(VaultBase.TransferFailed.selector);
        rejectEther.withdraw(vault);

        (uint256 amount,) = SavingsFacet(payable(vault)).savings(address(rejectEther));
        assertEq(amount, 1 ether);
        assertEq(SavingsFacet(payable(vault)).totalSaved(), 1 ether);
    }

    function _addEmergencyFacet(EmergencyFacet facet) private {
        _cut(IDiamond.FacetCutAction.Add, address(facet));
    }

    function _cut(IDiamond.FacetCutAction action, address facet) private {
        IDiamond.FacetCut[] memory cut = new IDiamond.FacetCut[](1);
        cut[0] = IDiamond.FacetCut(facet, action, VaultSelectors.emergency());
        IDiamondCut(vault).diamondCut(cut, address(0), "");
    }

    function _emergencyFacetAddress() private view returns (address) {
        return IDiamondLoupe(vault).facetAddress(EmergencyFacet.emergencyWithdraw.selector);
    }
}

contract RejectEther {
    function deposit(address vault) external payable {
        SavingsFacet(payable(vault)).deposit{value: msg.value}(7 days);
    }

    function withdraw(address vault) external {
        EmergencyFacet(vault).emergencyWithdraw();
    }

    receive() external payable {
        revert();
    }
}
