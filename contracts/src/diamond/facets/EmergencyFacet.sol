//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {LibDiamond} from "diamond-1-hardhat/libraries/LibDiamond.sol";
import {LibVault} from "../libraries/LibVault.sol";
import {VaultBase} from "../VaultBase.sol";

contract EmergencyFacet is VaultBase {
    event EmergencyWithdraw(address indexed user, uint256 payout, uint256 commission);

    function emergencyWithdraw() external nonReentrant {
        LibVault.VaultStorage storage vs = LibVault.vaultStorage();
        LibVault.Savings storage s = vs.savings[msg.sender];

        uint256 amount = s.amount;
        if (amount == 0) revert NothingSaved();

        uint256 commission = amount / 10;
        uint256 payout = amount - commission;

        s.amount = 0;
        s.unlockTime = 0;
        vs.totalSaved -= amount;

        (bool userPaid,) = payable(msg.sender).call{value: payout}("");
        if (!userPaid) revert TransferFailed();

        (bool ownerPaid,) = payable(LibDiamond.contractOwner()).call{value: commission}("");
        if (!ownerPaid) revert TransferFailed();

        emit EmergencyWithdraw(msg.sender, payout, commission);
    }
}
