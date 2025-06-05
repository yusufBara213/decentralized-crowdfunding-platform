# Decentralized Crowdfunding Platform

A simple, decentralized crowdfunding platform built on Bitcoin via Stacks using Clarity smart contracts. This platform enables users to create fundraising campaigns with automatic fund management - funds are only released when campaigns meet their goals, otherwise contributors can claim refunds.

## Features

- **Campaign Creation**: Users can create crowdfunding campaigns with customizable goals and deadlines
- **Secure Contributions**: Contributors send STX tokens that are held securely in the smart contract
- **Automatic Fund Management**: Funds are only released to campaign creators when goals are met
- **Refund Mechanism**: Contributors can claim refunds if campaigns fail to meet their goals
- **Transparent Tracking**: All campaign data and contributions are publicly viewable on-chain

## How It Works

1. **Create Campaign**: Campaign creators set a funding goal, deadline, and campaign details
2. **Accept Contributions**: Users contribute STX tokens to campaigns they want to support
3. **Goal Achievement**: When campaigns reach their funding goal after the deadline, creators can claim funds
4. **Refund Process**: If campaigns don't meet their goals, contributors can claim refunds

## Smart Contract Functions

### Public Functions

- `create-campaign`: Create a new crowdfunding campaign
- `contribute`: Contribute STX tokens to a specific campaign
- `complete-campaign`: Claim funds from a successful campaign (creator only)
- `refund-contribution`: Claim refund from a failed campaign

### Read-Only Functions

- `get-campaign`: Get campaign details by ID
- `get-contribution`: Get contribution amount for a specific user and campaign
- `get-campaign-contributors`: Get list of all contributors for a campaign
- `is-campaign-successful`: Check if a campaign has met its funding goal
- `is-campaign-ended`: Check if a campaign has passed its deadline

## Contract Architecture

The contract uses three main data structures:

- **campaigns**: Stores campaign metadata including creator, goal, raised amount, and status
- **contributions**: Tracks individual contribution amounts per user per campaign
- **campaign-contributors**: Maintains lists of contributors for each campaign

## Security Features

- **Access Control**: Only campaign creators can claim funds from successful campaigns
- **Time-based Logic**: Campaigns have deadlines that prevent late contributions
- **Goal Verification**: Funds can only be claimed if the funding goal is met
- **Refund Protection**: Contributors can only claim refunds from failed campaigns

## Usage Example

```clarity
;; Create a campaign with 1000 STX goal and 1000 block duration
(create-campaign "My Project" "Building something awesome" u1000000000 u1000)

;; Contribute 100 STX to campaign #1
(contribute u1 u100000000)

;; Check campaign status
(get-campaign u1)

;; Complete campaign (if goal met and deadline passed)
(complete-campaign u1)

;; Or claim refund (if goal not met and deadline passed)
(refund-contribution u1)
```

## Development

This contract is written in Clarity and designed to be simple and secure. All amounts are in microSTX (1 STX = 1,000,000 microSTX).

## Testing

The contract includes comprehensive tests covering all major functionality including campaign creation, contributions, fund claiming, and refunds. Run tests using Vitest.

## License

This project is open source and available under the MIT License.
