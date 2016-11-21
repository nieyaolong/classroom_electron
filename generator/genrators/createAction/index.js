/**
 * Create an action
 * Created by ZhuGongpu on 16/8/26.
 */
const prompt = require("../../prompts/createAction/index");
const handler = require("../../handlers/createAction/index");

module.exports = () => {
    return prompt().then(answers => {
        return handler(answers.directory, answers.actionName, answers.params, answers.isThreePaced);
    })
};