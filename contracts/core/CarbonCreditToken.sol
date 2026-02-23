// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./CarbonCreditNFT.sol";

/**
 * @title CarbonCreditToken (CCT)
 * @notice ERC-20 wrapper for carbon credit NFTs to enable AMM trading
 * @dev NFTs are locked in this contract → CCT minted 1:1 by CO2 tonnes
 * 
 * Key Features:
 * - 1 CCT = 1 tonne CO2 offset
 * - NFTs remain locked until unwrapped
 * - Separate pools for different methodologies (ICM/Verra/Gold Standard)
 * - Transparent backing - users can query which NFTs back their tokens
 */
contract CarbonCreditToken is 
    ERC20, 
    ERC20Burnable,
    AccessControl, 
    Pausable,
    ReentrancyGuard 
{
    bytes32 public constant WRAPPER_ROLE = keccak256("WRAPPER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    // ============ STATE VARIABLES ============
    
    /// @notice Reference to underlying NFT contract
    CarbonCreditNFT public immutable nftContract;
    
    /// @notice Methodology filter (e.g., "VERRA_VCS" for CCT-VCS token)
    string public methodology;
    
    /// @notice Mapping of wrapped NFTs: tokenId => isWrapped
    mapping(uint256 => bool) public wrappedNFTs;
    
    /// @notice User's wrapped NFT holdings: user => tokenIds[]
    mapping(address => uint256[]) private userWrappedNFTs;
    
    /// @notice Reverse lookup: tokenId => array index in userWrappedNFTs
    mapping(uint256 => uint256) private nftIndexInUserArray;
    
    /// @notice Total number of NFTs wrapped
    uint256 public totalNFTsWrapped;
    
    /// @notice Total CO2 tonnes represented by this token
    uint256 public totalTonnesWrapped;

    // ============ EVENTS ============
    
    event CreditWrapped(
        address indexed user,
        uint256 indexed tokenId,
        uint256 co2Tonnes
    );
    
    event CreditUnwrapped(
        address indexed user,
        uint256 indexed tokenId,
        uint256 co2Tonnes
    );
    
    event BatchWrapped(
        address indexed user,
        uint256[] tokenIds,
        uint256 totalTonnes
    );

    // ============ CONSTRUCTOR ============
    
    /**
     * @param name_ Token name (e.g., "ATMOS Carbon Credit - Verra")
     * @param symbol_ Token symbol (e.g., "CCT-VCS")
     * @param nftContract_ Address of CarbonCreditNFT contract
     * @param methodology_ Carbon standard filter (e.g., "VERRA_VCS")
     */
    constructor(
        string memory name_,
        string memory symbol_,
        address nftContract_,
        string memory methodology_
    ) ERC20(name_, symbol_) {
        require(nftContract_ != address(0), "Invalid NFT contract");
        
        nftContract = CarbonCreditNFT(nftContract_);
        methodology = methodology_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(WRAPPER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    // ============ CORE FUNCTIONS ============

    /**
     * @notice Wrap a carbon credit NFT into fungible tokens
     * @dev NFT is transferred to this contract and locked
     * @param tokenId NFT token ID to wrap
     * @return tonnesMinted Amount of CCT minted (equals NFT's co2Tonnes)
     */
    function wrapCredit(uint256 tokenId) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256 tonnesMinted) 
    {
        require(nftContract.ownerOf(tokenId) == msg.sender, "Not NFT owner");
        require(!wrappedNFTs[tokenId], "Already wrapped");

        // Get credit details
        CarbonCreditNFT.CarbonCredit memory credit = nftContract.getCreditDetails(tokenId);
        
        // Verify methodology matches this token pool
        require(
            keccak256(abi.encodePacked(credit.methodology)) == 
            keccak256(abi.encodePacked(methodology)),
            "Methodology mismatch"
        );
        
        require(!credit.isRetired, "Cannot wrap retired credit");

        // Transfer NFT to this contract (lock)
        nftContract.transferFrom(msg.sender, address(this), tokenId);

        // Mark as wrapped
        wrappedNFTs[tokenId] = true;
        
        // Add to user's wrapped NFT list
        userWrappedNFTs[msg.sender].push(tokenId);
        nftIndexInUserArray[tokenId] = userWrappedNFTs[msg.sender].length - 1;
        
        // Update stats
        totalNFTsWrapped++;
        totalTonnesWrapped += credit.co2Tonnes;

        // Mint ERC-20 tokens (1 tonne = 1e18 tokens)
        tonnesMinted = credit.co2Tonnes;
        _mint(msg.sender, tonnesMinted);

        emit CreditWrapped(msg.sender, tokenId, tonnesMinted);

        return tonnesMinted;
    }

    /**
     * @notice Batch wrap multiple NFTs (gas-optimized)
     * @param tokenIds Array of NFT token IDs
     * @return totalMinted Total CCT tokens minted
     */
    function batchWrap(uint256[] calldata tokenIds) 
        external 
        whenNotPaused
        nonReentrant
        returns (uint256 totalMinted) 
    {
        require(tokenIds.length > 0 && tokenIds.length <= 50, "Invalid batch size");
        
        totalMinted = 0;

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            
            require(nftContract.ownerOf(tokenId) == msg.sender, "Not NFT owner");
            require(!wrappedNFTs[tokenId], "Already wrapped");

            CarbonCreditNFT.CarbonCredit memory credit = nftContract.getCreditDetails(tokenId);
            
            require(
                keccak256(abi.encodePacked(credit.methodology)) == 
                keccak256(abi.encodePacked(methodology)),
                "Methodology mismatch"
            );
            
            require(!credit.isRetired, "Cannot wrap retired credit");

            nftContract.transferFrom(msg.sender, address(this), tokenId);
            
            wrappedNFTs[tokenId] = true;
            userWrappedNFTs[msg.sender].push(tokenId);
            nftIndexInUserArray[tokenId] = userWrappedNFTs[msg.sender].length - 1;
            
            totalMinted += credit.co2Tonnes;
        }

        totalNFTsWrapped += tokenIds.length;
        totalTonnesWrapped += totalMinted;

        _mint(msg.sender, totalMinted);

        emit BatchWrapped(msg.sender, tokenIds, totalMinted);

        return totalMinted;
    }

    /**
     * @notice Unwrap fungible tokens back into a specific NFT
     * @dev Burns CCT tokens and returns locked NFT
     * @param tokenId NFT token ID to unwrap
     * @return tonnesBurned Amount of CCT burned
     */
    function unwrapCredit(uint256 tokenId) 
        external 
        nonReentrant
        returns (uint256 tonnesBurned) 
    {
        require(wrappedNFTs[tokenId], "NFT not wrapped");
        
        CarbonCreditNFT.CarbonCredit memory credit = nftContract.getCreditDetails(tokenId);
        tonnesBurned = credit.co2Tonnes;
        
        require(balanceOf(msg.sender) >= tonnesBurned, "Insufficient CCT balance");

        // Burn CCT tokens
        _burn(msg.sender, tonnesBurned);

        // Mark as unwrapped
        wrappedNFTs[tokenId] = false;
        
        // Remove from user's wrapped list (if they're the original wrapper)
        _removeFromUserArray(msg.sender, tokenId);
        
        // Update stats
        totalNFTsWrapped--;
        totalTonnesWrapped -= tonnesBurned;

        // Transfer NFT back to user
        nftContract.transferFrom(address(this), msg.sender, tokenId);

        emit CreditUnwrapped(msg.sender, tokenId, tonnesBurned);

        return tonnesBurned;
    }

    /**
     * @notice Unwrap any available NFT (for users who bought CCT on AMM)
     * @dev Unwraps first available NFT from contract's holdings
     * @param amount Amount of CCT to unwrap (must match an NFT's tonnes exactly)
     */
    function unwrapAny(uint256 amount) 
        external 
        nonReentrant
        returns (uint256 tokenId) 
    {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance");
        require(totalNFTsWrapped > 0, "No NFTs available");

        // Find an NFT matching the requested amount
        tokenId = _findMatchingNFT(amount);
        require(tokenId != 0, "No matching NFT found");

        // Burn CCT
        _burn(msg.sender, amount);

        // Update state
        wrappedNFTs[tokenId] = false;
        totalNFTsWrapped--;
        totalTonnesWrapped -= amount;

        // Transfer NFT
        nftContract.transferFrom(address(this), msg.sender, tokenId);

        emit CreditUnwrapped(msg.sender, tokenId, amount);

        return tokenId;
    }

    // ============ VIEW FUNCTIONS ============

    /**
     * @notice Get all NFTs wrapped by a user
     */
    function getUserWrappedNFTs(address user) 
        external 
        view 
        returns (uint256[] memory) 
    {
        return userWrappedNFTs[user];
    }

    /**
     * @notice Get total backing (transparency check)
     */
    function getBackingInfo() 
        external 
        view 
        returns (
            uint256 nftsLocked,
            uint256 tonnesLocked,
            uint256 tokensCirculating
        ) 
    {
        return (
            totalNFTsWrapped,
            totalTonnesWrapped,
            totalSupply()
        );
    }

    /**
     * @notice Verify 1:1 backing ratio
     */
    function isFullyBacked() external view returns (bool) {
        return totalSupply() == totalTonnesWrapped;
    }

    // ============ INTERNAL HELPERS ============

    function _removeFromUserArray(address user, uint256 tokenId) private {
        uint256 index = nftIndexInUserArray[tokenId];
        uint256 lastIndex = userWrappedNFTs[user].length - 1;

        if (index != lastIndex) {
            uint256 lastTokenId = userWrappedNFTs[user][lastIndex];
            userWrappedNFTs[user][index] = lastTokenId;
            nftIndexInUserArray[lastTokenId] = index;
        }

        userWrappedNFTs[user].pop();
        delete nftIndexInUserArray[tokenId];
    }

    function _findMatchingNFT(uint256 targetAmount) 
        private 
        view 
        returns (uint256) 
    {
        uint256 totalTokens = nftContract.totalSupply();
        
        for (uint256 i = 1; i <= totalTokens; i++) {
            if (wrappedNFTs[i] && nftContract.ownerOf(i) == address(this)) {
                CarbonCreditNFT.CarbonCredit memory credit = nftContract.getCreditDetails(i);
                if (credit.co2Tonnes == targetAmount) {
                    return i;
                }
            }
        }
        
        return 0;
    }

    // ============ ADMIN FUNCTIONS ============

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    // Prevent transfers when paused
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override whenNotPaused {
        super._beforeTokenTransfer(from, to, amount);
    }

    /**
     * @notice Decimals = 18 (1 token = 1 tonne CO2)
     */
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}
