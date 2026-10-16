// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test} from "forge-std/Test.sol";
import {EntryPoint} from "account-abstraction/core/EntryPoint.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/PackedUserOperation.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {MinimalAccount} from "../src/aa/MinimalAccount.sol";

contract Target {
    uint256 public number;

    function setNumber(uint256 newNumber) external {
        number = newNumber;
    }
}

contract MinimalAccountTest is Test {
    uint256 private constant OWNER_KEY = 0xA11CE;
    uint256 private constant WRONG_KEY = 0xB0B;

    EntryPoint private entryPoint;
    MinimalAccount private account;
    Target private target;

    function setUp() public {
        entryPoint = new EntryPoint();
        account = new MinimalAccount(address(entryPoint));
        account.transferOwnership(vm.addr(OWNER_KEY));
        target = new Target();
        vm.deal(address(account), 1 ether);
    }

    function testBatchThroughEntryPoint() public {
        PackedUserOperation memory userOp = _signedUserOp(OWNER_KEY);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        entryPoint.handleOps(ops, payable(vm.addr(0xBEEF)));

        assertEq(target.number(), 2);
    }

    function testBatchRejectsDifferentLengths() public {
        address[] memory dests = new address[](2);
        uint256[] memory values = new uint256[](1);
        bytes[] memory datas = new bytes[](2);

        vm.prank(account.owner());
        vm.expectRevert(MinimalAccount.ArrayLengthMismatch.selector);
        account.executeBatch(dests, values, datas);
    }

    function testWrongSignatureIsRejected() public {
        PackedUserOperation memory userOp = _signedUserOp(WRONG_KEY);
        PackedUserOperation[] memory ops = new PackedUserOperation[](1);
        ops[0] = userOp;

        vm.expectRevert(abi.encodeWithSelector(IEntryPoint.FailedOp.selector, 0, "AA24 signature error"));
        entryPoint.handleOps(ops, payable(address(this)));
    }

    function _signedUserOp(uint256 key) private view returns (PackedUserOperation memory userOp) {
        address[] memory dests = new address[](2);
        uint256[] memory values = new uint256[](2);
        bytes[] memory datas = new bytes[](2);
        dests[0] = address(target);
        dests[1] = address(target);
        datas[0] = abi.encodeCall(Target.setNumber, (1));
        datas[1] = abi.encodeCall(Target.setNumber, (2));

        userOp = PackedUserOperation({
            sender: address(account),
            nonce: entryPoint.getNonce(address(account), 0),
            initCode: "",
            callData: abi.encodeCall(MinimalAccount.executeBatch, (dests, values, datas)),
            accountGasLimits: bytes32((uint256(300_000) << 128) | uint256(300_000)),
            preVerificationGas: 50_000,
            gasFees: bytes32((uint256(1 gwei) << 128) | uint256(1 gwei)),
            paymasterAndData: "",
            signature: ""
        });

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(entryPoint.getUserOpHash(userOp));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        userOp.signature = abi.encodePacked(r, s, v);
    }
}
