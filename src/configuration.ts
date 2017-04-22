'use strict';
import { OutputLevel } from './logger';
import { IRuleset } from './rulesProvider';

export interface IConfig {
    debug: boolean;
    outputLevel: OutputLevel;
    rulesets: IRuleset[];
    workspaceRulesets: IRuleset[];
    applyRulesets: string[];
    applyWorkspaceRulesets: string[];
    autoOpen: boolean;
    openPreview: boolean;
}