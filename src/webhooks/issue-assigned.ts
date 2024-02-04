import {Context, Probot} from "probot";
import {Config} from "../entities/Config";
import {isModeAuto, loadConfig, shouldOpenPR} from "../config";
import {getAssignee, getIssueTitle} from "../context";
import {
    branchExists,
    createIssueBranch,
    createPr,
    getBranchNameFromIssue,
    getSourceBranch,
    skipBranchCreationForIssue,
    skipForIssue
} from "../github";

const utils = require('../utils')
const core = require('@actions/core')

export async function issueAssigned(app: Probot, ctx: Context<any>) {
    app.log.debug('Issue was assigned');
    const config = await loadConfig(ctx);
    if (config) {
        if (!isModeAuto(config)) {
            return;
        }
        await handle(app, ctx, config);
        utils.logMemoryUsage(app);
    }
}

async function handle(app: Probot, ctx: Context<any>, config: Config) {
    if (skipForIssue(ctx, config)) {
        app.log(`Skipping run for issue: ${getIssueTitle(ctx)}`)
        return
    }
    let branchName
    if (skipBranchCreationForIssue(ctx, config)) {
        app.log(`Skipping branch creation for issue: ${getIssueTitle(ctx)}`)
        branchName = await getSourceBranch(ctx, config)
    } else {
        branchName = await getBranchNameFromIssue(ctx, config)
        if (await branchExists(ctx, branchName)) {
            app.log('Could not create branch as it already exists')
            if (utils.isRunningInGitHubActions()) {
                core.setOutput('branchName', branchName)
            }
            return
        }
        await createIssueBranch(app, ctx, branchName, config)
    }
    const shouldCreatePR = shouldOpenPR(config)
    if (shouldCreatePR) {
        const assignee = getAssignee(ctx)
        app.log(`Creating pull request for user ${assignee}`)
        await createPr(app, ctx, config, assignee, branchName)
    }
}