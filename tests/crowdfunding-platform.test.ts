import { describe, it, expect, beforeEach } from "vitest";

// Mock Clarity contract execution environment
class MockContract {
  constructor() {
    this.campaigns = new Map();
    this.contributions = new Map();
    this.campaignContributors = new Map();
    this.nextCampaignId = 1;
    this.blockHeight = 1000;
    this.balances = new Map();
  }

  // Helper function to create contribution key
  getContributionKey(campaignId, contributor) {
    return `${campaignId}-${contributor}`;
  }

  // Mock STX transfer
  stxTransfer(amount, from, to) {
    const fromBalance = this.balances.get(from) || 0;
    if (fromBalance < amount) {
      throw new Error("Insufficient balance");
    }
    this.balances.set(from, fromBalance - amount);
    this.balances.set(to, (this.balances.get(to) || 0) + amount);
    return { success: true };
  }

  // Create campaign function
  createCampaign(title, description, goal, duration, creator) {
    if (goal <= 0 || duration <= 0) {
      return { error: 406 }; // ERR_INVALID_AMOUNT
    }

    const campaignId = this.nextCampaignId++;
    const deadline = this.blockHeight + duration;

    this.campaigns.set(campaignId, {
      creator,
      title,
      description,
      goal,
      raised: 0,
      deadline,
      completed: false,
      fundsClaimed: false,
    });

    this.campaignContributors.set(campaignId, []);

    return { success: campaignId };
  }

  // Contribute function
  contribute(campaignId, amount, contributor) {
    if (amount <= 0) {
      return { error: 406 }; // ERR_INVALID_AMOUNT
    }

    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { error: 404 }; // ERR_NOT_FOUND
    }

    if (this.blockHeight >= campaign.deadline || campaign.completed) {
      return { error: 400 }; // ERR_CAMPAIGN_ENDED
    }

    // Mock STX transfer to contract
    try {
      this.stxTransfer(amount, contributor, "contract");
    } catch (e) {
      return { error: 406 };
    }

    // Update contribution
    const contributionKey = this.getContributionKey(campaignId, contributor);
    const currentContribution = this.contributions.get(contributionKey) || 0;
    this.contributions.set(contributionKey, currentContribution + amount);

    // Add contributor to list if not present
    const contributors = this.campaignContributors.get(campaignId);
    if (!contributors.includes(contributor)) {
      contributors.push(contributor);
    }

    // Update campaign raised amount
    campaign.raised += amount;

    return { success: true };
  }

  // Complete campaign function
  completeCampaign(campaignId, caller) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { error: 404 }; // ERR_NOT_FOUND
    }

    if (caller !== campaign.creator) {
      return { error: 401 }; // ERR_UNAUTHORIZED
    }

    if (this.blockHeight < campaign.deadline) {
      return { error: 407 }; // ERR_CAMPAIGN_NOT_ENDED
    }

    if (campaign.raised < campaign.goal) {
      return { error: 403 }; // ERR_GOAL_NOT_MET
    }

    if (campaign.fundsClaimed) {
      return { error: 405 }; // ERR_ALREADY_CLAIMED
    }

    // Transfer funds to creator
    this.stxTransfer(campaign.raised, "contract", campaign.creator);

    // Mark as completed and claimed
    campaign.completed = true;
    campaign.fundsClaimed = true;

    return { success: true };
  }

  // Refund contribution function
  refundContribution(campaignId, contributor) {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      return { error: 404 }; // ERR_NOT_FOUND
    }

    if (this.blockHeight < campaign.deadline) {
      return { error: 402 }; // ERR_CAMPAIGN_ACTIVE
    }

    if (campaign.raised >= campaign.goal) {
      return { error: 403 }; // ERR_GOAL_NOT_MET (campaign was successful)
    }

    const contributionKey = this.getContributionKey(campaignId, contributor);
    const contribution = this.contributions.get(contributionKey);

    if (!contribution || contribution <= 0) {
      return { error: 406 }; // ERR_INVALID_AMOUNT
    }

    // Transfer refund to contributor
    this.stxTransfer(contribution, "contract", contributor);

    // Remove contribution
    this.contributions.delete(contributionKey);

    return { success: true };
  }

  // Read-only functions
  getCampaign(campaignId) {
    return this.campaigns.get(campaignId) || null;
  }

  getContribution(campaignId, contributor) {
    const contributionKey = this.getContributionKey(campaignId, contributor);
    return this.contributions.get(contributionKey) || 0;
  }

  getCampaignContributors(campaignId) {
    return this.campaignContributors.get(campaignId) || [];
  }

  isCampaignSuccessful(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    return campaign ? campaign.raised >= campaign.goal : false;
  }

  isCampaignEnded(campaignId) {
    const campaign = this.campaigns.get(campaignId);
    return campaign ? this.blockHeight >= campaign.deadline : false;
  }

  // Test helper to advance block height
  advanceBlocks(blocks) {
    this.blockHeight += blocks;
  }

  // Test helper to set balance
  setBalance(address, amount) {
    this.balances.set(address, amount);
  }
}

describe("Crowdfunding Contract", () => {
  let contract;
  const creator = "SP1K1A1PMGW2ZJUEG8FSTJ0FZ8PNW6TSMQTX2QQER";
  const contributor1 = "SP2K2A2PMGW2ZJUEG8FSTJ0FZ8PNW6TSMQTX3QQER";
  const contributor2 = "SP3K3A3PMGW2ZJUEG8FSTJ0FZ8PNW6TSMQTX4QQER";

  beforeEach(() => {
    contract = new MockContract();
    // Set initial balances
    contract.setBalance(creator, 10000000000); // 10,000 STX
    contract.setBalance(contributor1, 5000000000); // 5,000 STX
    contract.setBalance(contributor2, 5000000000); // 5,000 STX
  });

  describe("Campaign Creation", () => {
    it("should create a campaign successfully", () => {
      const result = contract.createCampaign(
        "Test Campaign",
        "A test crowdfunding campaign",
        1000000000, // 1,000 STX goal
        144, // 144 blocks duration (~1 day)
        creator
      );

      expect(result.success).toBe(1);

      const campaign = contract.getCampaign(1);
      expect(campaign).toBeTruthy();
      expect(campaign.creator).toBe(creator);
      expect(campaign.title).toBe("Test Campaign");
      expect(campaign.goal).toBe(1000000000);
      expect(campaign.raised).toBe(0);
      expect(campaign.completed).toBe(false);
    });

    it("should reject campaign with zero goal", () => {
      const result = contract.createCampaign(
        "Invalid Campaign",
        "Campaign with zero goal",
        0,
        144,
        creator
      );

      expect(result.error).toBe(406); // ERR_INVALID_AMOUNT
    });

    it("should reject campaign with zero duration", () => {
      const result = contract.createCampaign(
        "Invalid Campaign",
        "Campaign with zero duration",
        1000000000,
        0,
        creator
      );

      expect(result.error).toBe(406); // ERR_INVALID_AMOUNT
    });
  });

  describe("Contributions", () => {
    beforeEach(() => {
      // Create a test campaign
      contract.createCampaign(
        "Test Campaign",
        "A test campaign",
        1000000000, // 1,000 STX goal
        144,
        creator
      );
    });

    it("should accept valid contributions", () => {
      const result = contract.contribute(1, 500000000, contributor1); // 500 STX
      expect(result.success).toBe(true);

      const campaign = contract.getCampaign(1);
      expect(campaign.raised).toBe(500000000);

      const contribution = contract.getContribution(1, contributor1);
      expect(contribution).toBe(500000000);
    });

    it("should track multiple contributors", () => {
      contract.contribute(1, 300000000, contributor1); // 300 STX
      contract.contribute(1, 400000000, contributor2); // 400 STX

      const campaign = contract.getCampaign(1);
      expect(campaign.raised).toBe(700000000);

      const contributors = contract.getCampaignContributors(1);
      expect(contributors).toContain(contributor1);
      expect(contributors).toContain(contributor2);
      expect(contributors.length).toBe(2);
    });

    it("should accumulate multiple contributions from same user", () => {
      contract.contribute(1, 200000000, contributor1); // 200 STX
      contract.contribute(1, 300000000, contributor1); // 300 STX

      const contribution = contract.getContribution(1, contributor1);
      expect(contribution).toBe(500000000); // 500 STX total

      const campaign = contract.getCampaign(1);
      expect(campaign.raised).toBe(500000000);
    });

    it("should reject contributions to non-existent campaigns", () => {
      const result = contract.contribute(999, 100000000, contributor1);
      expect(result.error).toBe(404); // ERR_NOT_FOUND
    });

    it("should reject contributions after deadline", () => {
      contract.advanceBlocks(200); // Move past deadline

      const result = contract.contribute(1, 100000000, contributor1);
      expect(result.error).toBe(400); // ERR_CAMPAIGN_ENDED
    });

    it("should reject zero contributions", () => {
      const result = contract.contribute(1, 0, contributor1);
      expect(result.error).toBe(406); // ERR_INVALID_AMOUNT
    });
  });

  describe("Campaign Completion", () => {
    beforeEach(() => {
      // Create and fund a successful campaign
      contract.createCampaign(
        "Success Campaign",
        "Will succeed",
        1000000000,
        144,
        creator
      );
      contract.contribute(1, 600000000, contributor1); // 600 STX
      contract.contribute(1, 500000000, contributor2); // 500 STX
      // Total: 1,100 STX (exceeds 1,000 STX goal)
    });

    it("should allow creator to complete successful campaign after deadline", () => {
      contract.advanceBlocks(200); // Past deadline

      const result = contract.completeCampaign(1, creator);
      expect(result.success).toBe(true);

      const campaign = contract.getCampaign(1);
      expect(campaign.completed).toBe(true);
      expect(campaign.fundsClaimed).toBe(true);

      // Check creator received funds
      expect(contract.balances.get(creator)).toBe(10000000000 + 1100000000);
    });

    it("should reject completion by non-creator", () => {
      contract.advanceBlocks(200);

      const result = contract.completeCampaign(1, contributor1);
      expect(result.error).toBe(401); // ERR_UNAUTHORIZED
    });

    it("should reject completion before deadline", () => {
      const result = contract.completeCampaign(1, creator);
      expect(result.error).toBe(407); // ERR_CAMPAIGN_NOT_ENDED
    });

    it("should reject completion if goal not met", () => {
      // Create campaign that won't meet goal
      contract.createCampaign(
        "Fail Campaign",
        "Will fail",
        2000000000,
        144,
        creator
      );
      contract.contribute(2, 500000000, contributor1); // Only 500 STX of 2,000 goal

      contract.advanceBlocks(200);

      const result = contract.completeCampaign(2, creator);
      expect(result.error).toBe(403); // ERR_GOAL_NOT_MET
    });
  });

  describe("Refunds", () => {
    beforeEach(() => {
      // Create a campaign that will fail
      contract.createCampaign(
        "Fail Campaign",
        "Will fail",
        2000000000,
        144,
        creator
      );
      contract.contribute(1, 300000000, contributor1); // 300 STX
      contract.contribute(1, 200000000, contributor2); // 200 STX
      // Total: 500 STX (less than 2,000 STX goal)
    });

    it("should allow refunds for failed campaigns after deadline", () => {
      contract.advanceBlocks(200); // Past deadline

      const result = contract.refundContribution(1, contributor1);
      expect(result.success).toBe(true);

      // Check contributor received refund
      expect(contract.balances.get(contributor1)).toBe(5000000000); // Back to original 5,000 STX

      // Check contribution was removed
      expect(contract.getContribution(1, contributor1)).toBe(0);
    });

    it("should reject refunds before deadline", () => {
      const result = contract.refundContribution(1, contributor1);
      expect(result.error).toBe(402); // ERR_CAMPAIGN_ACTIVE
    });

    it("should reject refunds for successful campaigns", () => {
      // Add more contributions to make it successful
      contract.contribute(1, 2000000000, creator); // Make it exceed goal
      contract.advanceBlocks(200);

      const result = contract.refundContribution(1, contributor1);
      expect(result.error).toBe(403); // ERR_GOAL_NOT_MET (actually goal was met)
    });

    it("should reject refunds for non-contributors", () => {
      contract.advanceBlocks(200);

      const result = contract.refundContribution(
        1,
        "SP5K5A5PMGW2ZJUEG8FSTJ0FZ8PNW6TSMQTX6QQER"
      );
      expect(result.error).toBe(406); // ERR_INVALID_AMOUNT (no contribution found)
    });
  });
});
