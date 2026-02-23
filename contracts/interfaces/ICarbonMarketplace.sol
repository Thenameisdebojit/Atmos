// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICarbonMarketplace
 * @notice Interface for CarbonMarketplace
 */
interface ICarbonMarketplace {
    
    struct Order {
        uint256 orderId;
        address trader;
        bool isBuyOrder;
        uint256 amount;
        uint256 pricePerTonne;
        uint256 filled;
        bool isActive;
        uint256 createdAt;
        uint256 expiresAt;
        bool requiresKYC;
    }

    struct Pool {
        uint256 carbonReserve;
        uint256 stableReserve;
        uint256 totalLPTokens;
        uint256 lastPrice;
        uint256 lastUpdate;
    }

    // Events
    event OrderCreated(
        uint256 indexed orderId,
        address indexed trader,
        bool isBuyOrder,
        uint256 amount,
        uint256 pricePerTonne
    );

    event OrderFilled(
        uint256 indexed orderId,
        address indexed taker,
        uint256 amountFilled,
        uint256 totalCost
    );

    event Swap(
        address indexed trader,
        bool carbonToStable,
        uint256 amountIn,
        uint256 amountOut,
        uint256 fee
    );

    // Order Book Functions
    function createBuyOrder(
        uint256 amount,
        uint256 pricePerTonne,
        uint256 expiresIn,
        bool requiresKYC_
    ) external returns (uint256 orderId);

    function createSellOrder(
        uint256 amount,
        uint256 pricePerTonne,
        uint256 expiresIn,
        bool requiresKYC_
    ) external returns (uint256 orderId);

    function fillOrder(uint256 orderId, uint256 amount) external;

    function cancelOrder(uint256 orderId) external;

    // AMM Functions
    function addLiquidity(uint256 carbonAmount, uint256 stableAmount) 
        external 
        returns (uint256 lpMinted);

    function removeLiquidity(uint256 lpAmount) 
        external 
        returns (uint256 carbonAmount, uint256 stableAmount);

    function swap(
        bool carbonToStable,
        uint256 amountIn,
        uint256 minAmountOut
    ) external returns (uint256 amountOut);

    // View Functions
    function getPrice() external view returns (uint256);

    function getOrder(uint256 orderId) external view returns (Order memory);

    function getUserOrders(address user) external view returns (uint256[] memory);

    function ammPool() external view returns (Pool memory);
}
