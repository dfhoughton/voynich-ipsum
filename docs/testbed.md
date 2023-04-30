<style>
    body {
    padding: 5rem 10rem;
    }
    label {
    font-weight: bold;
    }
    #essay {
    white-space: pre-wrap;
    }
    #grid {
    display: grid;
    grid-template-columns: 1fr 3fr;
    margin-top: 2rem;
    }
    .column {
    padding: 0 2rem;
    }
    .column:first-child {
    padding: 0;
    }
    .divider {
    border-right: 1px solid #999;
    padding-right: 1rem;
    }
    .controls {
    display: flex;
    flex-direction: row;
    justify-content: center;
    }
    .left,
    .right {
    display: inline-block;
    cursor: pointer;
    }
    .left {
    rotate: 90deg;
    margin-right: 1rem;
    }
    .right {
    rotate: 270deg;
    }
    .lang {
    line-height: 2rem;
    cursor: pointer;
    }
    .lang:nth-child(even) {
    background-color: #eee;
    }
</style>

# Language Test Bed

Choose a language from the column on the left or change the seed to try a new language.

<div id="grid">
    <div class="column">
    <!-- infinite pages language picker -->
    <div class="divider">
        <div class="controls">
        <span class="left">&nabla;</span>
        <span class="right">&nabla;</span>
        </div>
        <div id="language-picker"></div>
        <div class="controls">
        <span class="left">&nabla;</span>
        <span class="right">&nabla;</span>
        </div>
    </div>
    </div>
    <div class="column">
    <!-- current language -->
    <label>Seed <input id="seed" type="number" value="1" /></label>
    <button id="change-seed">Apply</button>
    <h2 id="name">Language Name</h2>
    <h3>Assertion <button id="assertion-again">again!</button></h3>
    <div id="assertion">This is a sample assertion.</div>
    <h3>Question <button id="question-again">again!</button></h3>
    <div id="question">This is a sample question?</div>
    <h3>Exclamation <button id="exclamation-again">again!</button></h3>
    <div id="exclamation">This is a sample exclamation!</div>
    <h3>Essay <button id="essay-again">again!</button></h3>
    <div id="essay">This is a sample essay.</div>
    </div>
</div>
<script src="app.js"></script>
