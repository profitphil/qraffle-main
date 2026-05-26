# 🎲 Qraffle

Qraffle is a decentralized raffle system built on the Qubic blockchain with **DAO governance** and **dual raffle mechanics**. It features provably fair winner selection and an epoch-based system where registered participants govern token raffles while standard QU raffles run automatically every epoch.

## 🌟 Features

### 🎯 Dual Raffle System

- **Standard QU Raffles**: Automatic epoch-based raffles with community-determined entry amounts
- **Token Raffles**: DAO-governed raffles supporting any Qubic-based token through proposals

### 🏛️ DAO Governance

- **Register System**: Become a registered participant with voting rights and revenue sharing
- **Proposal Voting**: Community decides which token raffles to activate each epoch
- **Entry Amount Control**: Registers collectively set standard raffle entry amounts

### 🔒 Provably Fair

- **Transparent Selection**: Provably fair and tamper-proof winner selection
- **Epoch-Based Cycles**: Predictable timing with clear opening and closing periods
- **Historical Tracking**: Complete audit trail of all raffles and winners

### 💰 Fair Distribution

- **80% Prize Pool**: Winners receive majority of collected funds
- **20% Fee Structure**: Transparent distribution across burn, shareholders, registers, system, and charity
- **Revenue Sharing**: Registered participants earn 5% of all raffle proceeds
- **Deflationary Burns**: 5% of fees permanently removed from circulation

## 🔄 How It Works

### Standard QU Raffle (Every Epoch)

1. **📊 Entry Amount Setting**: Registered participants submit entry amounts for the next epoch
2. **📈 Amount Calculation**: System averages all submitted amounts to determine entry cost
3. **🎫 User Participation**: Anyone can deposit the entry amount to join the raffle
4. **⏰ Epoch End**: Raffle closes automatically at epoch conclusion
5. **🎲 Winner Selection**: Provably fair winner selection process
6. **💰 Prize Distribution**: Winner receives 80% of total pool, 20% distributed as fees

### Token Raffle (Community Driven)

1. **📝 Proposal Submission**: Registered participants propose token raffles with specific parameters
2. **🗳️ Community Voting**: All registers vote on active proposals throughout the epoch
3. **🏆 Proposal Selection**: Highest voted proposal (if any) wins and activates next epoch
4. **🎫 Token Entry**: Users deposit specified token amounts to participate
5. **🎲 Fair Selection**: Same provably fair selection process as standard raffles
6. **💎 Token Prizes**: Winners receive 80% of collected tokens

### Fee Distribution (20% of All Proceeds)

- **🔥 Burn (5%)**: Tokens permanently removed from circulation
- **👥 Shareholders (8%)**: Distributed to token holders
- **🏛️ Registers (5%)**: Revenue for DAO participants
- **⚙️ System (1%)**: Platform maintenance
- **💝 Charity (1%)**: Donated to @Kimz300

## 🏛️ DAO Registration & Benefits

### Becoming a Register

- **Registration Fee**: 1,000,000,000 QU (one-time payment)
- **Maximum Registers**: 65,536 participants
- **Logout Fee**: 50,000,000 QU (if you choose to leave)

### Register Benefits

- **📈 Revenue Sharing**: Receive 5% of all raffle proceeds distributed among registers
- **🗳️ Voting Rights**: Vote on token raffle proposals each epoch
- **📊 Entry Control**: Submit entry amounts for standard QU raffles
- **🎯 Proposal Power**: Submit token raffle proposals for community voting

### Register Responsibilities

- Submit entry amounts for standard raffles each epoch
- Participate in governance decisions through voting
- Maintain active registration status

## 🔧 Smart Contract Architecture

### Core Constants

- **Registration Amount**: 1,000,000,000 QU
- **Maximum Registers**: 65,536
- **Maximum Proposals per Epoch**: 1,024
- **Maximum Raffle Members**: 262,144
- **Initial Standard Entry Amount**: 1,000,000 QU

### Key Data Structures

- **Registers Collection**: Tracks all registered DAO participants
- **Proposals System**: Manages token raffle proposals and voting
- **Raffle Members**: Maintains participant lists for both raffle types
- **Historical Records**: Complete audit trail of all past raffles

### Available Functions

- **System Management**: Registration, logout, entry amount submission
- **Governance**: Proposal submission and voting
- **Raffle Participation**: Entry into standard and token raffles
- **Query Functions**: Check registration status, voting history, active proposals

## 🎮 Getting Started

### For General Users

1. Connect your Qubic wallet
2. Choose between standard QU raffle or active token raffles
3. Deposit the required entry amount
4. Wait for epoch end and winner selection

### For DAO Participants

1. Register with 1,000,000,000 QU to become a registered participant
2. Submit entry amounts for next epoch's standard raffle
3. Propose token raffles or vote on existing proposals
4. Enjoy revenue sharing from all raffle activities
