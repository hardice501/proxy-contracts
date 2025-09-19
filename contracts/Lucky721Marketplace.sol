// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import {ERC721URIStorage} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import {ERC721Pausable} from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

contract Lucky721Marketplace is 
    ERC721, 
    ERC721Enumerable, 
    ERC721URIStorage, 
    ERC721Pausable, 
    Ownable2Step, 
    ReentrancyGuard 
{
    // ============ 상태 변수 ============
    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10000;
    uint256 public constant MINT_PRICE = 0.01 ether;
    uint256 public constant STAKING_REWARD_RATE = 100; // 1% per day (100 basis points)

    // 마켓플레이스 관련
    struct Listing {
        address seller;
        uint256 tokenId;
        uint256 price;
        bool active;
        uint256 timestamp;
    }

    mapping(uint256 => Listing) public listings;
    uint256[] public activeListings;
    mapping(address => uint256[]) public userListings;

    // 스테이킹 관련
    struct StakingInfo {
        address staker;
        uint256 tokenId;
        uint256 stakedAt;
        uint256 lastClaimed;
        uint256 totalRewards;
    }

    mapping(uint256 => StakingInfo) public stakingInfo;
    mapping(address => uint256[]) public userStakedTokens;
    uint256 public totalStakedTokens;

    // 이벤트
    event TokenListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event TokenDelisted(uint256 indexed tokenId, address indexed seller);
    event TokenPurchased(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event TokenStaked(uint256 indexed tokenId, address indexed staker);
    event TokenUnstaked(uint256 indexed tokenId, address indexed staker, uint256 rewards);
    event RewardsClaimed(address indexed staker, uint256 amount);

    constructor(address initialOwner)
        ERC721("Lucky721 Marketplace", "LUCKY")
        Ownable(initialOwner)
    {
        console.log("Lucky721Marketplace deployed with owner:", initialOwner);
    }

    // ============ 민팅 기능 ============
    function mint(address to, string memory uri) public payable returns (uint256) {
        require(_nextTokenId < MAX_SUPPLY, "Max supply reached");
        require(msg.value >= MINT_PRICE, "Insufficient payment");

        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);

        // 초과 지불분 반환
        if (msg.value > MINT_PRICE) {
            payable(msg.sender).transfer(msg.value - MINT_PRICE);
        }

        return tokenId;
    }

    function batchMint(address to, string[] memory uris) public payable returns (uint256[] memory) {
        require(uris.length > 0 && uris.length <= 10, "Invalid batch size");
        require(_nextTokenId + uris.length <= MAX_SUPPLY, "Exceeds max supply");
        require(msg.value >= MINT_PRICE * uris.length, "Insufficient payment");

        uint256[] memory tokenIds = new uint256[](uris.length);

        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = _nextTokenId++;
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            tokenIds[i] = tokenId;
        }

        // 초과 지불분 반환
        if (msg.value > MINT_PRICE * uris.length) {
            payable(msg.sender).transfer(msg.value - (MINT_PRICE * uris.length));
        }

        return tokenIds;
    }

    // ============ 마켓플레이스 기능 ============
    function listToken(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(price > 0, "Price must be greater than 0");
        require(!listings[tokenId].active, "Token already listed");

        listings[tokenId] = Listing({
            seller: msg.sender,
            tokenId: tokenId,
            price: price,
            active: true,
            timestamp: block.timestamp
        });

        activeListings.push(tokenId);
        userListings[msg.sender].push(tokenId);

        emit TokenListed(tokenId, msg.sender, price);
    }

    function delistToken(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        require(listings[tokenId].active, "Token not listed");

        listings[tokenId].active = false;

        // activeListings에서 제거
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == tokenId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }

        emit TokenDelisted(tokenId, msg.sender);
    }

    function buyToken(uint256 tokenId) external payable nonReentrant {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Token not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(msg.sender != listing.seller, "Cannot buy own token");

        // 토큰 전송
        _transfer(listing.seller, msg.sender, tokenId);

        // 판매자에게 지불
        payable(listing.seller).transfer(listing.price);

        // 초과 지불분 반환
        if (msg.value > listing.price) {
            payable(msg.sender).transfer(msg.value - listing.price);
        }

        // 리스팅 비활성화
        listing.active = false;

        // activeListings에서 제거
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == tokenId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }

        emit TokenPurchased(tokenId, msg.sender, listing.seller, listing.price);
    }

    // ============ 스테이킹 기능 ============
    function stakeToken(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(stakingInfo[tokenId].staker == address(0), "Token already staked");

        stakingInfo[tokenId] = StakingInfo({
            staker: msg.sender,
            tokenId: tokenId,
            stakedAt: block.timestamp,
            lastClaimed: block.timestamp,
            totalRewards: 0
        });

        userStakedTokens[msg.sender].push(tokenId);
        totalStakedTokens++;

        emit TokenStaked(tokenId, msg.sender);
    }

    function unstakeToken(uint256 tokenId) external {
        StakingInfo storage info = stakingInfo[tokenId];
        require(info.staker == msg.sender, "Not the staker");

        uint256 rewards = calculateRewards(tokenId);
        info.totalRewards += rewards;

        // 사용자 스테이킹 목록에서 제거
        for (uint256 i = 0; i < userStakedTokens[msg.sender].length; i++) {
            if (userStakedTokens[msg.sender][i] == tokenId) {
                userStakedTokens[msg.sender][i] = userStakedTokens[msg.sender][userStakedTokens[msg.sender].length - 1];
                userStakedTokens[msg.sender].pop();
                break;
            }
        }

        // 스테이킹 정보 초기화
        delete stakingInfo[tokenId];
        totalStakedTokens--;

        emit TokenUnstaked(tokenId, msg.sender, rewards);
    }

    function claimRewards(uint256 tokenId) external {
        StakingInfo storage info = stakingInfo[tokenId];
        require(info.staker == msg.sender, "Not the staker");

        uint256 rewards = calculateRewards(tokenId);
        require(rewards > 0, "No rewards to claim");

        info.lastClaimed = block.timestamp;
        info.totalRewards += rewards;

        // 실제로는 ERC20 토큰으로 보상 지급 (여기서는 이벤트만 발생)
        emit RewardsClaimed(msg.sender, rewards);
    }

    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakingInfo memory info = stakingInfo[tokenId];
        if (info.staker == address(0)) return 0;

        uint256 stakingDuration = block.timestamp - info.lastClaimed;
        uint256 dailyReward = (info.stakedAt * STAKING_REWARD_RATE) / 10000; // 1% of staked amount per day
        return (stakingDuration * dailyReward) / 1 days;
    }

    // ============ 조회 기능 ============
    function getActiveListings() external view returns (uint256[] memory) {
        return activeListings;
    }

    function getUserListings(address user) external view returns (uint256[] memory) {
        return userListings[user];
    }

    function getUserStakedTokens(address user) external view returns (uint256[] memory) {
        return userStakedTokens[user];
    }

    function getListing(uint256 tokenId) external view returns (Listing memory) {
        return listings[tokenId];
    }

    function getStakingInfo(uint256 tokenId) external view returns (StakingInfo memory) {
        return stakingInfo[tokenId];
    }

    function getMarketplaceStats() external view returns (
        uint256 totalListings,
        uint256 totalStaked,
        uint256 totalVolume
    ) {
        return (activeListings.length, totalStakedTokens, address(this).balance);
    }

    // ============ 관리자 기능 ============
    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function setMintPrice(uint256 newPrice) external onlyOwner {
        // MINT_PRICE는 상수이므로 실제로는 다른 변수 사용 필요
    }

    // ============ 필수 오버라이드 ============
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable, ERC721Pausable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
