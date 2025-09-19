// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AccessControlNFT
 * @dev ERC721 기반의 AccessControl을 사용한 NFT 컨트랙트
 * 
 * 역할:
 * - DEFAULT_ADMIN_ROLE: 전체 관리자
 * - MINTER_ROLE: 민팅 권한
 * - BURNER_ROLE: 소각 권한
 * - PAUSER_ROLE: 일시정지 권한
 * - UPDATER_ROLE: 메타데이터 업데이트 권한
 */
contract AccessControlNFT is ERC721, AccessControl, ERC721Pausable, ReentrancyGuard {
    
    // 역할 정의
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    
    // 상태 변수
    uint256 private _tokenIdCounter;
    string private _baseTokenURI;
    uint256 public maxSupply;
    uint256 public mintPrice;
    uint256 public maxMintPerAddress;
    
    // 매핑
    mapping(address => uint256) public mintedCount;
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => uint256) public tokenLevel;
    mapping(uint256 => bool) public isLocked;
    
    // 이벤트
    event TokenMinted(address indexed to, uint256 indexed tokenId, uint256 level);
    event TokenBurned(uint256 indexed tokenId);
    event TokenLevelUpdated(uint256 indexed tokenId, uint256 newLevel);
    event MetadataUpdated(uint256 indexed tokenId, string newURI);
    event MintPriceUpdated(uint256 newPrice);
    event MaxSupplyUpdated(uint256 newMaxSupply);
    event TokenLock(uint256 indexed tokenId, bool locked);

    // 에러
    error ExceedsMaxSupply();
    error ExceedsMaxMintPerAddress();
    error InsufficientPayment();
    error InvalidTokenId();
    error TransferNotAllowed();
    error TokenLocked(uint256 tokenId, bool locked);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory baseTokenURI,
        uint256 _maxSupply,
        uint256 _mintPrice,
        uint256 _maxMintPerAddress
    ) ERC721(name, symbol) {
        _baseTokenURI = baseTokenURI;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        maxMintPerAddress = _maxMintPerAddress;
        
        // 기본 관리자 역할 설정
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
    }
    
    // ============ 민팅 함수 ============
    
    /**
     * @dev 일반 민팅 (결제 필요)
     */
    function mint(address to, uint256 level) external payable whenNotPaused nonReentrant {
        if (totalSupply() >= maxSupply) revert ExceedsMaxSupply();
        if (mintedCount[to] >= maxMintPerAddress) revert ExceedsMaxMintPerAddress();
        if (msg.value < mintPrice) revert InsufficientPayment();
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        tokenLevel[tokenId] = level;
        mintedCount[to]++;
        
        emit TokenMinted(to, tokenId, level);
    }
    
    /**
     * @dev 관리자 민팅 (결제 불필요)
     */
    function adminMint(address to, uint256 level) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (totalSupply() >= maxSupply) revert ExceedsMaxSupply();
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        tokenLevel[tokenId] = level;
        
        emit TokenMinted(to, tokenId, level);
    }
    
    /**
     * @dev 배치 민팅
     */
    function batchMint(address[] calldata tos, uint256[] calldata levels) external onlyRole(MINTER_ROLE) whenNotPaused {
        if (tos.length != levels.length) revert("Arrays length mismatch");
        if (totalSupply() + tos.length > maxSupply) revert ExceedsMaxSupply();
        
        for (uint256 i = 0; i < tos.length; i++) {
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            
            _safeMint(tos[i], tokenId);
            tokenLevel[tokenId] = levels[i];
            
            emit TokenMinted(tos[i], tokenId, levels[i]);
        }
    }
    
    // ============ 소각 함수 ============
    
    /**
     * @dev 토큰 소각
     */
    function burn(uint256 tokenId) external {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        if (isLocked[tokenId]) revert TokenLocked(tokenId, isLocked[tokenId]);
        
        // 소유자 또는 BURNER_ROLE만 소각 가능
        if (ownerOf(tokenId) != msg.sender && !hasRole(BURNER_ROLE, msg.sender)) {
            revert TransferNotAllowed();
        }
        
        _burn(tokenId);
        delete tokenLevel[tokenId];
        delete _tokenURIs[tokenId];
        
        emit TokenBurned(tokenId);
    }
    
    // ============ 업데이트 함수 ============
    /*
     * @dev 토큰 레벨 업데이트
     */
    function updateTokenLevel(uint256 tokenId, uint256 newLevel) external onlyRole(UPDATER_ROLE) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();

        tokenLevel[tokenId] = newLevel;
        emit TokenLevelUpdated(tokenId, newLevel);
    }

    function setTokenLock(uint256 tokenId, bool locked) external onlyRole(UPDATER_ROLE) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        
        isLocked[tokenId] = locked;
        emit TokenLock(tokenId, isLocked[tokenId]);
    }
    
    /**
     * @dev 개별 토큰 URI 설정
     */
    function setTokenURI(uint256 tokenId, string calldata tokenURI) external onlyRole(UPDATER_ROLE) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        
        _tokenURIs[tokenId] = tokenURI;
        emit MetadataUpdated(tokenId, tokenURI);
    }
    
    /**
     * @dev 베이스 URI 업데이트
     */
    function setBaseURI(string calldata newBaseURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = newBaseURI;
    }
    
    /**
     * @dev 민팅 가격 업데이트
     */
    function setMintPrice(uint256 newPrice) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }
    
    /**
     * @dev 최대 공급량 업데이트
     */
    function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxSupply >= totalSupply(), "New max supply too low");
        maxSupply = newMaxSupply;
        emit MaxSupplyUpdated(newMaxSupply);
    }
    
    /**
     * @dev 주소당 최대 민팅 수량 업데이트
     */
    function setMaxMintPerAddress(uint256 newMaxMint) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxMintPerAddress = newMaxMint;
    }
    
    // ============ 일시정지 함수 ============
    
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }
    
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
    
    // ============ 전송 제한 ============
    
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override(ERC721, ERC721Pausable) returns (address) {
        if (isLocked[tokenId]) revert TokenLocked(tokenId, true);
        return super._update(to, tokenId, auth);
    }
    
    // ============ 뷰 함수 ============
    
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }
    
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        
        string memory tokenURI_ = _tokenURIs[tokenId];
        if (bytes(tokenURI_).length > 0) {
            return tokenURI_;
        }
        
        return string(abi.encodePacked(_baseTokenURI, _toString(tokenId)));
    }
    
    function getTokenLevel(uint256 tokenId) external view returns (uint256) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        return tokenLevel[tokenId];
    }
    
    function isTokenLocked(uint256 tokenId) external view returns (bool) {
        if (_tokenIdCounter <= tokenId) revert InvalidTokenId();
        return isLocked[tokenId];
    }
    
    function getMintedCount(address account) external view returns (uint256) {
        return mintedCount[account];
    }
    
    function getContractInfo() external view returns (
        uint256 currentSupply,
        uint256 maxSupply_,
        uint256 price,
        uint256 maxPerAddress,
        bool paused_
    ) {
        return (
            totalSupply(),
            maxSupply,
            mintPrice,
            maxMintPerAddress,
            paused()
        );
    }
    
    // ============ 관리자 함수 ============
    
    function withdraw() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(msg.sender).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    function emergencyWithdraw(address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(to).call{value: balance}("");
        require(success, "Emergency withdrawal failed");
    }
    
    // ============ 인터페이스 지원 ============
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
    
    // ============ 유틸리티 함수 ============
    
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
