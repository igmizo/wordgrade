import { registerPlugin } from "@wordpress/plugins";
import { PluginDocumentSettingPanel } from "@wordpress/editor";
import { PanelBody, Tooltip, Button } from "@wordpress/components";
import { 
  chartBar, 
  check, 
  warning as warningIcon, 
  help, 
  edit, 
  chevronUp, 
  chevronDown,
  info,
  closeSmall
} from "@wordpress/icons";
import { useSelect } from "@wordpress/data";
import { useState, useEffect } from "@wordpress/element";
import { __ } from "@wordpress/i18n";

// Fallback for older WordPress versions
const PluginDocumentSettingPanelCompat =
  wp.editor?.PluginDocumentSettingPanel ??
  wp.editPost?.PluginDocumentSettingPanel ??
  wp.editSite?.PluginDocumentSettingPanel;

// Debounce utility to prevent excessive recalculations
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Readability calculation functions (ported from PHP back to JavaScript)
const round = (number, precision = 2) => {
  const k = Math.pow(10, precision || 0);
  return Math.floor(number * k + 0.5 * Math.sign(number)) / k;
};

const stripHTMLTags = (str) => {
  return str.replace(/(<([^>]+)>)/gi, "");
};

const removeShortcodes = (str) => {
  return str.replace(/\[.*?\]/g, "");
};

const addNewLines = (text) => {
  let formattedText = text.replace(
    /<h[1-6]>([^<]*)<\/h[1-6]>/g,
    "<h$1>$1</h$1>\n"
  );
  return formattedText.replaceAll("</p>", "</p>\n");
};

const removeDoubleNewLines = (text) => {
  return text.replaceAll("\n\n", "\n");
};

const cleanText = (text) => {
  let cleanedText = removeShortcodes(text);
  cleanedText = addNewLines(cleanedText);
  cleanedText = stripHTMLTags(cleanedText);
  cleanedText = removeDoubleNewLines(cleanedText);
  return cleanedText;
};

const calculate = (text) => {
  const sentenceRegex = new RegExp("[.?!\n]", "g");
  const syllableRegex = new RegExp("[aiouy]+e*|e(?!d$|ly).|[td]ed|le$", "g");
  const punctuation = [
    "!",
    '"',
    "#",
    "$",
    "%",
    "&",
    "'",
    "(",
    ")",
    "*",
    "+",
    ",",
    "-",
    ".",
    "/",
    ":",
    ";",
    "<",
    "=",
    ">",
    "?",
    "@",
    "[",
    "]",
    "^",
    "_",
    "`",
    "{",
    "|",
    "}",
    "~",
  ];

  let cache = {};

  const charCount = (text) => {
    if (cache.charCount) return cache.charCount;
    text = text.replace(/\s/g, "");
    return (cache.charCount = text.length);
  };

  const removePunctuation = (text) => {
    return text
      .split("")
      .filter((c) => punctuation.indexOf(c) === -1)
      .join("");
  };

  const letterCount = (text) => {
    text = text.replace(/\s/g, "");
    return removePunctuation(text).length;
  };

  const lexiconCount = (text, useCache) => {
    if (useCache && cache.lexiconCount) return cache.lexiconCount;
    text = removePunctuation(text);
    const words = text.split(" ").filter((word) => word !== "");
    const lexicon = words.length;
    return useCache ? (cache.lexiconCount = lexicon) : lexicon;
  };

  const getWords = (text, useCache) => {
    if (useCache && cache.getWords) return cache.getWords;
    text = text.toLowerCase();
    text = removePunctuation(text);
    const words = text.split(" ").filter((word) => word !== "");
    return useCache ? (cache.getWords = words) : words;
  };

  const syllableCount = (text, useCache) => {
    if (useCache && cache.syllableCount) return cache.syllableCount;
    const syllables = getWords(text, useCache).reduce((a, c) => {
      return a + (c.match(syllableRegex) || [1]).length;
    }, 0);
    return useCache ? (cache.syllableCount = syllables) : syllables;
  };

  const polySyllableCount = (text, useCache) => {
    let count = 0;
    getWords(text, useCache).forEach((word) => {
      const syllables = (word.match(syllableRegex) || [1]).length;
      if (syllables >= 3) {
        count += 1;
      }
    });
    return count;
  };

  const sentenceCount = (text, useCache) => {
    if (useCache && cache.sentenceCount) return cache.sentenceCount;
    let ignoreCount = 0;
    const sentences = text.split(sentenceRegex);
    sentences.forEach((s) => {
      if (lexiconCount(s, true) <= 2) {
        ignoreCount += 1;
      }
    });
    const count = Math.max(1, sentences.length - ignoreCount);
    return useCache ? (cache.sentenceCount = count) : count;
  };

  const avgSentenceLength = (text) => {
    const avg = lexiconCount(text, true) / sentenceCount(text, true);
    return round(avg);
  };

  const avgSyllablesPerWord = (text) => {
    const avg = syllableCount(text, true) / lexiconCount(text, true);
    return round(avg);
  };

  const avgCharactersPerWord = (text) => {
    const avg = charCount(text) / lexiconCount(text, true);
    return round(avg);
  };

  const avgLettersPerWord = (text) => {
    const avg = letterCount(text) / lexiconCount(text, true);
    return round(avg);
  };

  const avgSentencesPerWord = (text) => {
    const avg = sentenceCount(text, true) / lexiconCount(text, true);
    return round(avg);
  };

  const fleschReadingEase = (text) => {
    const sentenceLength = avgSentenceLength(text);
    const syllablesPerWord = avgSyllablesPerWord(text);
    return round(206.835 - 1.015 * sentenceLength - 84.6 * syllablesPerWord);
  };

  const fleschKincaidGrade = (text) => {
    const sentenceLength = avgSentenceLength(text);
    const syllablesPerWord = avgSyllablesPerWord(text);
    return round(0.39 * sentenceLength + 11.8 * syllablesPerWord - 15.59);
  };

  const smogIndex = (text) => {
    const sentences = sentenceCount(text, true);
    if (sentences >= 3) {
      const polySyllables = polySyllableCount(text, true);
      const smog = 1.043 * Math.sqrt(polySyllables * (30 / sentences)) + 3.1291;
      return round(smog);
    }
    return 0.0;
  };

  const colemanLiauIndex = (text) => {
    const letters = round(avgLettersPerWord(text) * 100, 2);
    const sentences = round(avgSentencesPerWord(text) * 100, 2);
    const coleman = 0.0588 * letters - 0.296 * sentences - 15.8;
    return round(coleman);
  };

  const automatedReadabilityIndex = (text) => {
    const chars = charCount(text);
    const words = lexiconCount(text, true);
    const sentences = sentenceCount(text, true);
    const readability =
      4.71 * (chars / words) + 0.5 * (words / sentences) - 21.43;
    return round(readability);
  };

  const linsearWriteFormula = (text) => {
    let easyWord = 0;
    let difficultWord = 0;
    const roughTextFirst100 = text.split(" ").slice(0, 100).join(" ");
    const plainTextListFirst100 = getWords(text, true).slice(0, 100);
    plainTextListFirst100.forEach((word) => {
      const syllables = (word.match(syllableRegex) || [1]).length;
      if (syllables < 3) {
        easyWord += 1;
      } else {
        difficultWord += 1;
      }
    });
    let number =
      (easyWord + difficultWord * 3) / sentenceCount(roughTextFirst100);
    if (number <= 20) {
      number -= 2;
    }
    return round(number / 2);
  };

  const rix = (text) => {
    const words = getWords(text, true);
    const longCount = words.filter((word) => word.length > 6).length;
    const sentencesCount = sentenceCount(text, true);
    return round(longCount / sentencesCount);
  };

  const readingTime = (text) => {
    const wordsPerSecond = 4.17; // 250 words per minute
    const seconds = round(lexiconCount(text, false) / wordsPerSecond);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes + " min " + round(remainingSeconds, 0) + " sec";
  };

  // Clean the input text
  text = cleanText(text);

  // Return all readability scores
  return {
    fleschReadingEase: fleschReadingEase(text),
    fleschKincaidGrade: fleschKincaidGrade(text),
    smogIndex: smogIndex(text),
    colemanLiauIndex: colemanLiauIndex(text),
    ari: automatedReadabilityIndex(text),
    linsearWriteFormula: linsearWriteFormula(text),
    rix: rix(text),
    readingTime: readingTime(text),
    wordCount: lexiconCount(text, true),
  };
};

// Helper function to get score color
const getScoreColor = (score, metric) => {
  if (metric === "fleschReadingEase") {
    if (score >= 90) return "#20B054"; // Very easy - Green
    if (score >= 80) return "#6BBF59"; // Easy
    if (score >= 70) return "#B5DE6A"; // Fairly easy
    if (score >= 60) return "#EFEF5F"; // Standard
    if (score >= 50) return "#F5C244"; // Fairly difficult
    if (score >= 30) return "#F0833A"; // Difficult
    return "#E05D44"; // Very difficult - Red
  } else {
    // For grade-level metrics, lower is generally more accessible
    if (score <= 6) return "#20B054"; // Green - Elementary school
    if (score <= 8) return "#6BBF59"; // Middle school
    if (score <= 10) return "#B5DE6A"; // Early high school
    if (score <= 12) return "#EFEF5F"; // High school
    if (score <= 14) return "#F5C244"; // College
    if (score <= 16) return "#F0833A"; // Graduate
    return "#E05D44"; // Red - Professional
  }
};

// Helper function to get score description
const getScoreDescription = (score, metric) => {
  if (metric === "fleschReadingEase") {
    if (score >= 90) return "Very easy to read. Easily understood by an average 11-year-old student.";
    if (score >= 80) return "Easy to read. Conversational English for consumers.";
    if (score >= 70) return "Fairly easy to read.";
    if (score >= 60) return "Plain English. Easily understood by 13- to 15-year-old students.";
    if (score >= 50) return "Fairly difficult to read.";
    if (score >= 30) return "Difficult to read.";
    return "Very difficult to read. Best understood by university graduates.";
  } else if (metric === "fleschKincaidGrade") {
    return `Indicates that the text is understandable by someone with ${score} years of education.`;
  } else if (metric === "smogIndex") {
    return `Years of education needed to understand the text. SMOG is often used for healthcare materials.`;
  } else if (metric === "colemanLiauIndex") {
    return `Grade level required to understand the text. Based on character and sentence counts.`;
  } else if (metric === "ari") {
    return `Automated Readability Index. Represents US grade level needed to comprehend the text.`;
  } else if (metric === "linsearWriteFormula") {
    return `Grade level based on easy vs. difficult words and sentence length.`;
  } else if (metric === "rix") {
    return `RIX index. Higher values indicate more difficult text.`;
  }
  return "";
};

// Component to render a score meter
const ScoreMeter = ({ label, score, metric, showTooltip = true }) => {
  const color = getScoreColor(score, metric);
  const description = getScoreDescription(score, metric);
  
  return (
    <div className="wordgrade-score-item" style={{ marginBottom: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
        <span style={{ fontWeight: "500" }}>{label}</span>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ 
            color: color, 
            fontWeight: "bold", 
            fontSize: "16px",
            marginRight: "6px" 
          }}>
            {score}
          </span>
          {showTooltip && (
            <Tooltip text={description}>
              <span style={{ display: "flex", color: "#828282" }}>
                {info}
              </span>
            </Tooltip>
          )}
        </div>
      </div>
      {metric !== "readingTime" && metric !== "wordCount" && (
        <div style={{ 
          height: "6px", 
          width: "100%", 
          backgroundColor: "#E0E0E0", 
          borderRadius: "3px", 
          overflow: "hidden"
        }}>
          <div style={{ 
            height: "100%", 
            width: `${metric === "fleschReadingEase" ? score : Math.min(score * 5, 100)}%`, 
            backgroundColor: color, 
            borderRadius: "3px",
            transition: "width 0.5s ease"
          }} />
        </div>
      )}
    </div>
  );
};

// Summary component to show overall readability
const ReadabilitySummary = ({ scores }) => {
  const fleschScore = scores.fleschReadingEase;
  let readabilityLevel;
  let dashicon;
  let color;

  if (fleschScore >= 80) {
    readabilityLevel = "Easy to read";
    dashicon = "yes-alt";
    color = "#20B054";
  } else if (fleschScore >= 60) {
    readabilityLevel = "Moderately readable";
    dashicon = "yes";
    color = "#B5DE6A";
  } else if (fleschScore >= 40) {
    readabilityLevel = "Somewhat difficult";
    dashicon = "warning";
    color = "#F5C244";
  } else {
    readabilityLevel = "Difficult to read";
    dashicon = "dismiss";
    color = "#E05D44";
  }

  return (
    <div style={{ 
      padding: "12px", 
      backgroundColor: "#f8f9fa", 
      borderRadius: "4px", 
      marginBottom: "16px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    }}>
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={{ color: color, display: "flex", marginRight: "10px", width: "24px", height: "24px" }}>
          {dashicon === "yes-alt" ? check : 
           dashicon === "yes" ? check : 
           dashicon === "warning" ? warningIcon : 
           closeSmall}
        </span>
        <div>
          <div style={{ fontWeight: "bold", color }}>{readabilityLevel}</div>
          <div style={{ fontSize: "12px", color: "#666" }}>Based on Flesch Reading Ease</div>
        </div>
      </div>
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "flex-end", 
        justifyContent: "center" 
      }}>
        <div style={{ fontWeight: "bold", fontSize: "18px" }}>
          {scores.readingTime}
        </div>
        <div style={{ fontSize: "12px", color: "#666" }}>
          {scores.wordCount} words
        </div>
      </div>
    </div>
  );
};

// Toggle to show/hide advanced metrics
const AdvancedMetricsToggle = ({ expanded, onClick }) => {
  return (
    <Button 
      onClick={onClick}
      style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        width: "100%",
        textAlign: "center",
        marginTop: "12px",
        marginBottom: "8px",
        color: "#007cba"
      }}
      isLink
    >
      {expanded ? "Hide advanced metrics " : "Show advanced metrics "}
      <span style={{ display: "flex", width: "20px", height: "20px" }}>
        {expanded ? chevronUp : chevronDown}
      </span>
    </Button>
  );
};

const WordGradePanel = () => {
  const [scores, setScores] = useState(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Check if the post type is publicly viewable
  const isViewable = useSelect((select) => {
    const postTypeName = select("core/editor").getCurrentPostType();
    const postTypeObject = select("core").getPostType(postTypeName);
    return postTypeObject?.viewable;
  }, []);

  // Get the post content
  const content = useSelect((select) => {
    return select("core/editor").getEditedPostAttribute("content");
  }, []);

  // Debounced function to calculate scores
  const debouncedCalculate = debounce((text) => {
    if (!text) {
      setScores(null);
      return;
    }
    const newScores = calculate(text);
    setScores(newScores);
  }, 500); // 500ms debounce

  // Subscribe to content changes
  useEffect(() => {
    debouncedCalculate(content);
  }, [content]);

  // Don't render the panel for non-viewable post types
  if (!isViewable) {
    return null;
  }

  return (
    <PluginDocumentSettingPanelCompat
      name="wordgrade-panel"
      title={
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={{ display: "flex", marginRight: "8px", width: "20px", height: "20px" }}>
            {chartBar}
          </span>
          {__("WordGrade Readability", "wordgrade")}
        </div>
      }
      className="wordgrade-panel"
    >
      <PanelBody>
        {scores ? (
          <div style={{ 
            fontSize: "14px",
            animation: "fadeIn 0.5s ease-in-out", 
          }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
              .wordgrade-panel .components-panel__body {
                padding: 0;
                border: none;
              }
              .wordgrade-panel .components-panel__body-title {
                margin-bottom: 0;
              }
            `}} />
            
            <ReadabilitySummary scores={scores} />
            
            <div style={{ borderBottom: "1px solid #eee", marginBottom: "12px" }}></div>
            
            <ScoreMeter 
              label="Flesch Reading Ease" 
              score={scores.fleschReadingEase} 
              metric="fleschReadingEase" 
            />
            
            <ScoreMeter 
              label="Flesch-Kincaid Grade" 
              score={scores.fleschKincaidGrade} 
              metric="fleschKincaidGrade" 
            />
            
            <AdvancedMetricsToggle 
              expanded={showAdvanced} 
              onClick={() => setShowAdvanced(!showAdvanced)} 
            />
            
            {showAdvanced && (
              <div style={{ 
                animation: "fadeIn 0.5s ease-in-out",
                marginTop: "8px" 
              }}>
                <ScoreMeter 
                  label="SMOG Index" 
                  score={scores.smogIndex} 
                  metric="smogIndex" 
                />
                
                <ScoreMeter 
                  label="Coleman-Liau Index" 
                  score={scores.colemanLiauIndex} 
                  metric="colemanLiauIndex" 
                />
                
                <ScoreMeter 
                  label="Auto. Readability Index" 
                  score={scores.ari} 
                  metric="ari" 
                />
                
                <ScoreMeter 
                  label="Linsear Write Formula" 
                  score={scores.linsearWriteFormula} 
                  metric="linsearWriteFormula" 
                />
                
                <ScoreMeter 
                  label="RIX" 
                  score={scores.rix} 
                  metric="rix" 
                />
              </div>
            )}
            
            <div style={{ 
              marginTop: "20px", 
              fontSize: "12px", 
              color: "#757575",
              fontStyle: "italic",
              textAlign: "center" 
            }}>
              Analyze as you write. Improve your content's readability.
            </div>
          </div>
        ) : (
          <div style={{ 
            padding: "20px 0", 
            textAlign: "center", 
            color: "#666" 
          }}>
            <span style={{ display: "flex", justifyContent: "center", marginBottom: "8px" }}>
              <span style={{ width: "24px", height: "24px" }}>{edit}</span>
            </span>
            <p>{__("No content to analyze yet.", "wordgrade")}</p>
            <p style={{ fontSize: "13px", fontStyle: "italic" }}>
              Start writing to see readability scores.
            </p>
          </div>
        )}
      </PanelBody>
    </PluginDocumentSettingPanelCompat>
  );
};

registerPlugin("wordgrade", {
  render: WordGradePanel,
  icon: chartBar
});